import * as crypto from "crypto";
import {
  hasFreeQueries,
  deductFreeQuery,
  recordPaidQuery,
  getOrCreateWallet,
  setPendingPayment,
  clearPendingPayment,
  setPreferredMode,
  getWalletStats,
  getQueryPrice,
  type PaymentMode,
} from "../payment/queryTracker";
import {
  verifyPayment,
  getWalletBalance,
} from "../payment/circlePayment";
import {
  verifyExternalPayment,
  SERVICE_WALLET_ADDRESS,
} from "../agent/agentWallet";

// ── Types ─────────────────────────────────────────────────────
export type IntelligenceResponse = {
  success:    boolean;
  queryId:    string;
  data?:      any;
  payment?:   PaymentRequired;
  error?:     string;
};

export type PaymentRequired = {
  required:     boolean;
  amount:       number;
  currency:     string;
  mode:         PaymentMode;
  destination:  string;
  queryId:      string;
  expiresAt?:   string;
  message:      string;
  instructions: string[];
};

// ── Agent wallet — bypasses payment gate ──────────────────────
const AGENT_WALLET = (process.env.CIRCLE_AGENT_WALLET_ADDRESS || "").toLowerCase();

function isAgentWallet(walletAddress: string): boolean {
  return walletAddress.toLowerCase() === AGENT_WALLET && AGENT_WALLET !== "";
}

// ── Shared block data from engine ─────────────────────────────
let sharedBlocks: any[] = [];

export function updateSharedBlocks(blocks: any[]) {
  sharedBlocks = blocks;
}

// ── Contract risk score ───────────────────────────────────────
function buildRiskScore(addr: string, blocks: any[]) {
  const lowerAddr = addr.toLowerCase();
  const relevant  = blocks.filter(
    (b) => b.topFailing?.[addr] || b.topFailing?.[lowerAddr]
  );
  const failureCount   = relevant.reduce(
    (s, b) => s + (b.topFailing?.[addr] || b.topFailing?.[lowerAddr] || 0), 0
  );
  const blocksAppeared = relevant.length;
  const totalTx        = relevant.reduce((s, b) => s + b.totalTx, 0);
  const failureRate    = totalTx > 0 ? (failureCount / totalTx) * 100 : 0;

  const riskScore = Math.min(100, Math.round(
    failureCount * 5 + blocksAppeared * 3 + failureRate * 2
  ));

  const riskLevel =
    riskScore >= 70 ? "CRITICAL" :
    riskScore >= 40 ? "HIGH"     :
    riskScore >= 20 ? "MEDIUM"   : "LOW";

  const classification =
    failureCount >= 10 && blocksAppeared >= 5 ? "📛 HIGH FREQUENCY FAILER" :
    blocksAppeared >= 5                       ? "⚠️ REPEAT OFFENDER"        :
    failureCount >= 3                         ? "🔄 RECURRING PATTERN"      :
    failureCount > 0                          ? "🔍 OCCASIONAL FAILURE"     :
                                                "✅ CLEAN";

  const recommendation =
    riskLevel === "CRITICAL" ? "Avoid transacting — extreme failure risk detected." :
    riskLevel === "HIGH"     ? "Proceed with caution — significant failure history." :
    riskLevel === "MEDIUM"   ? "Monitor closely — moderate failure activity observed." :
                               "Safe to transact — low failure risk detected.";

  const blockNumbers = relevant.map((b) => b.blockNumber);
  return {
    address:        addr,
    shortAddress:   `${addr.slice(0, 6)}...${addr.slice(-4)}`,
    failureCount,
    blocksAppeared,
    failureRate:    `${failureRate.toFixed(2)}%`,
    riskScore,
    riskLevel,
    classification,
    recommendation,
    firstSeen:      blockNumbers.length ? Math.min(...blockNumbers) : null,
    lastSeen:       blockNumbers.length ? Math.max(...blockNumbers) : null,
  };
}

// ── Network health snapshot ───────────────────────────────────
function buildNetworkHealth(blocks: any[]) {
  const recent      = blocks.slice(-30);
  const totalTx     = recent.reduce((s, b) => s + b.totalTx, 0);
  const totalFailed = recent.reduce((s, b) => s + b.failedTx, 0);
  const avgFailRate = recent.length
    ? recent.reduce((s, b) => s + b.failureRate, 0) / recent.length
    : 0;

  const healthScore = Math.max(0, Math.round(100 - avgFailRate * 400));
  const status      = healthScore >= 80 ? "HEALTHY" : healthScore >= 50 ? "DEGRADED" : "CRITICAL";

  const topContracts: Record<string, number> = {};
  for (const b of recent)
    for (const [addr, count] of Object.entries(b.topFailing || {}))
      topContracts[addr] = (topContracts[addr] || 0) + (count as number);

  const topFailing = Object.entries(topContracts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([addr, count]) => ({ address: addr, failures: count }));

  return {
    blocksAnalyzed:      recent.length,
    totalTransactions:   totalTx,
    totalFailures:       totalFailed,
    avgFailureRate:      `${(avgFailRate * 100).toFixed(2)}%`,
    healthScore,
    status,
    topFailingContracts: topFailing,
    latestBlock:         blocks[blocks.length - 1]?.blockNumber || null,
    timestamp:           new Date().toISOString(),
  };
}

// ── Gate logic ────────────────────────────────────────────────
async function handleQueryGate(
  walletAddress:    string,
  mode:             PaymentMode,
  queryId:          string,
  intelligenceData: any
): Promise<IntelligenceResponse> {

  // ── Agent bypass — never deducts queries or requires payment
  if (isAgentWallet(walletAddress)) {
    recordPaidQuery(walletAddress);
    return {
      success: true,
      queryId,
      data: {
        ...intelligenceData,
        meta: {
          tier:    "AGENT",
          message: "Agent access — paid via Circle USDC transfer",
        },
      },
    };
  }

  // ── Free tier ─────────────────────────────────────────────
  if (hasFreeQueries(walletAddress)) {
    deductFreeQuery(walletAddress);
    const stats = getWalletStats(walletAddress);
    return {
      success: true,
      queryId,
      data: {
        ...intelligenceData,
        meta: {
          tier:             "FREE",
          queriesRemaining: stats.freeQueriesLeft,
          message:          `${stats.freeQueriesLeft} free queries remaining. After that, send 0.1 USDC to ${SERVICE_WALLET_ADDRESS} and confirm with your tx hash.`,
        },
      },
    };
  }

  // ── Prepay — tell user exactly how to pay ─────────────────
  if (mode === "prepay") {
    return {
      success: false,
      queryId,
      payment: {
        required:     true,
        amount:       getQueryPrice(),
        currency:     "USDC",
        mode:         "prepay",
        destination:  SERVICE_WALLET_ADDRESS,
        queryId,
        message:      `Free tier exhausted. Send ${getQueryPrice()} USDC to unlock this query.`,
        instructions: [
          `1. Send exactly ${getQueryPrice()} USDC to: ${SERVICE_WALLET_ADDRESS}`,
          `2. Use any Arc Testnet EVM wallet (MetaMask, Rabby, etc.)`,
          `3. After sending, call: POST /api/intelligence/confirm/${queryId}`,
          `4. Body: { "wallet": "YOUR_WALLET", "txHash": "YOUR_TX_HASH" }`,
          `5. Your intelligence data will be returned immediately`,
        ],
      },
    };
  }

  // ── Postpay — give data first, collect payment after ──────
  const pending = setPendingPayment(walletAddress, queryId, intelligenceData);
  return {
    success: true,
    queryId,
    data: {
      ...intelligenceData,
      meta: {
        tier:         "POSTPAY",
        amountDue:    getQueryPrice(),
        payTo:        SERVICE_WALLET_ADDRESS,
        expiresAt:    pending.expiresAt,
        message:      `Pay ${getQueryPrice()} USDC within 60 seconds to ${SERVICE_WALLET_ADDRESS}`,
        instructions: [
          `1. Send ${getQueryPrice()} USDC to: ${SERVICE_WALLET_ADDRESS}`,
          `2. Then call: POST /api/intelligence/confirm/${queryId}`,
          `3. Body: { "wallet": "YOUR_WALLET", "txHash": "YOUR_TX_HASH" }`,
        ],
      },
    },
  };
}

// ── Public API functions ──────────────────────────────────────

export async function queryContractIntelligence(
  contractAddress: string,
  walletAddress:   string,
  mode:            PaymentMode = "prepay"
): Promise<IntelligenceResponse> {
  const queryId = crypto.randomUUID();
  setPreferredMode(walletAddress, mode);
  const data = buildRiskScore(contractAddress, sharedBlocks);
  return handleQueryGate(walletAddress, mode, queryId, data);
}

export async function queryNetworkHealth(
  walletAddress: string,
  mode:          PaymentMode = "prepay"
): Promise<IntelligenceResponse> {
  const queryId = crypto.randomUUID();
  setPreferredMode(walletAddress, mode);
  const data = buildNetworkHealth(sharedBlocks);
  return handleQueryGate(walletAddress, mode, queryId, data);
}

export async function queryBlockAnalysis(
  blockNumber:   number,
  walletAddress: string,
  mode:          PaymentMode = "prepay"
): Promise<IntelligenceResponse> {
  const queryId = crypto.randomUUID();
  setPreferredMode(walletAddress, mode);

  const block = sharedBlocks.find((b) => b.blockNumber === blockNumber);
  if (!block) {
    return { success: false, queryId, error: `Block #${blockNumber} not found in current window` };
  }

  const data = {
    blockNumber:  block.blockNumber,
    totalTx:      block.totalTx,
    failedTx:     block.failedTx,
    failureRate:  `${(block.failureRate * 100).toFixed(2)}%`,
    severity:     block.failureRate >= 0.15 ? "CRITICAL" : block.failureRate >= 0.10 ? "HIGH" : "LOW",
    topContracts: Object.entries(block.topFailing || {})
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([addr, count]) => ({ address: addr, failures: count })),
    timestamp:    new Date().toISOString(),
  };

  return handleQueryGate(walletAddress, mode, queryId, data);
}

// ── Confirm payment — works for ANY Arc Testnet wallet ────────
export async function confirmPayment(
  queryId:       string,
  txHashOrId:    string,
  walletAddress: string
): Promise<IntelligenceResponse> {

  // ── Try Blockscout verification first (any EVM wallet) ────
  if (txHashOrId.startsWith("0x")) {
    const { confirmed } = await verifyExternalPayment(walletAddress);
    if (confirmed) {
      recordPaidQuery(walletAddress);
      clearPendingPayment(walletAddress);
      return {
        success: true,
        queryId,
        data: {
          message:     "Payment confirmed via Arc Explorer. Query unlocked.",
          txHash:      txHashOrId,
          explorerUrl: `https://testnet.arcscan.app/tx/${txHashOrId}`,
        },
      };
    }
    return {
      success: false,
      queryId,
      error: "Payment not found on Arc Testnet. Make sure you sent 0.1 USDC to the service wallet and try again.",
    };
  }

  // ── Fallback: Circle API verification (Circle wallets) ────
  const { confirmed } = await verifyPayment(txHashOrId);
  if (!confirmed) {
    return {
      success: false,
      queryId,
      error: "Payment not confirmed. Try again in a few seconds.",
    };
  }

  recordPaidQuery(walletAddress);
  clearPendingPayment(walletAddress);
  return {
    success: true,
    queryId,
    data: { message: "Payment confirmed. Query unlocked.", txId: txHashOrId },
  };
}

// ── Usage stats ───────────────────────────────────────────────
export async function getUsageStats(
  walletAddress: string
): Promise<IntelligenceResponse> {
  const stats   = getWalletStats(walletAddress);
  const balance = await getWalletBalance(process.env.CIRCLE_WALLET_ID!);

  return {
    success: true,
    queryId: crypto.randomUUID(),
    data: {
      wallet:           walletAddress,
      freeQueriesLeft:  stats.freeQueriesLeft,
      totalQueries:     stats.totalQueries,
      totalSpent:       `${stats.totalSpent} USDC`,
      preferredMode:    stats.preferredMode,
      serviceBalance:   `${balance} USDC`,
      pricePerQuery:    `${getQueryPrice()} USDC`,
      serviceWallet:    SERVICE_WALLET_ADDRESS,
      paymentInstructions: [
        `Send ${getQueryPrice()} USDC to: ${SERVICE_WALLET_ADDRESS}`,
        "Use any Arc Testnet EVM wallet",
        "Then call POST /api/intelligence/confirm/:queryId with your tx hash",
      ],
    },
  };
}