import * as crypto from "crypto";
import {
  hasFreeQueries,
  deductFreeQuery,
  hasPaidCredits,
  deductPaidCredit,
  addPaidCredit,
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
  success:  boolean;
  queryId:  string;
  data?:    any;
  payment?: PaymentRequired;
  error?:   string;
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

// ── Agent wallet bypass ────────────────────────────────────────
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
// Reads topFailingContracts which can be object {addr: count} or array [{address, failures}]
function getContractFailures(block: any, addr: string): number {
  const lowerAddr = addr.toLowerCase();

  // Format 1: object map { "0xABC": 3 }
  if (block.topFailingContracts && typeof block.topFailingContracts === "object" && !Array.isArray(block.topFailingContracts)) {
    return block.topFailingContracts[addr] || block.topFailingContracts[lowerAddr] || 0;
  }

  // Format 2: array [{ address: "0xABC", failures: 3 }]
  if (Array.isArray(block.topFailingContracts)) {
    const match = block.topFailingContracts.find(
      (c: any) => c.address?.toLowerCase() === lowerAddr
    );
    return match?.failures || 0;
  }

  // Format 3: topFailing map (dashboard format)
  if (block.topFailing && typeof block.topFailing === "object") {
    return block.topFailing[addr] || block.topFailing[lowerAddr] || 0;
  }

  return 0;
}

function buildRiskScore(addr: string, blocks: any[]) {
  const lowerAddr    = addr.toLowerCase();
  const relevant     = blocks.filter(b => getContractFailures(b, addr) > 0);
  const failureCount = relevant.reduce((s, b) => s + getContractFailures(b, addr), 0);
  const blocksAppeared = relevant.length;
  const totalTx      = relevant.reduce((s, b) => s + (b.totalTx || 0), 0);
  const failureRate  = totalTx > 0 ? (failureCount / totalTx) * 100 : 0;

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

  const blockNumbers = relevant.map(b => b.blockNumber);

  console.log(`🔍 Contract ${addr.slice(0,8)}... — failures: ${failureCount}, blocks: ${blocksAppeared}, riskLevel: ${riskLevel}`);

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
  const totalTx     = recent.reduce((s, b) => s + (b.totalTx || 0), 0);
  const totalFailed = recent.reduce((s, b) => s + (b.failedTx || 0), 0);
  const avgFailRate = recent.length
    ? recent.reduce((s, b) => s + (b.failureRate || 0), 0) / recent.length
    : 0;

  const healthScore = Math.max(0, Math.round(100 - avgFailRate * 400));
  const status      = healthScore >= 80 ? "HEALTHY" : healthScore >= 50 ? "DEGRADED" : "CRITICAL";

  // Build top failing contracts — handles both array and object formats
  const contractMap: Record<string, number> = {};
  for (const b of recent) {
    if (Array.isArray(b.topFailingContracts)) {
      for (const c of b.topFailingContracts) {
        contractMap[c.address] = (contractMap[c.address] || 0) + c.failures;
      }
    } else if (b.topFailingContracts && typeof b.topFailingContracts === "object") {
      for (const [addr, count] of Object.entries(b.topFailingContracts)) {
        contractMap[addr] = (contractMap[addr] || 0) + (count as number);
      }
    } else if (b.topFailing && typeof b.topFailing === "object") {
      for (const [addr, count] of Object.entries(b.topFailing)) {
        contractMap[addr] = (contractMap[addr] || 0) + (count as number);
      }
    }
  }

  const topFailing = Object.entries(contractMap)
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

  // ── Agent bypass ──────────────────────────────────────────
  if (isAgentWallet(walletAddress)) {
    recordPaidQuery(walletAddress);
    return {
      success: true,
      queryId,
      data: {
        ...intelligenceData,
        meta: { tier: "AGENT", message: "Agent access — paid via Circle USDC transfer" },
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
          paidCredits:      stats.paidCredits || 0,
          message:          `${stats.freeQueriesLeft} free queries remaining. After that, send 0.1 USDC to ${SERVICE_WALLET_ADDRESS} and confirm with your tx hash.`,
        },
      },
    };
  }

  // ── Paid credits — use if available ───────────────────────
  if (hasPaidCredits(walletAddress)) {
    deductPaidCredit(walletAddress);
    const stats = getWalletStats(walletAddress);
    return {
      success: true,
      queryId,
      data: {
        ...intelligenceData,
        meta: {
          tier:        "PAID",
          paidCredits: stats.paidCredits || 0,
          message:     `Paid credit used. ${stats.paidCredits} credits remaining.`,
        },
      },
    };
  }

  // ── Prepay — no credits, request payment ──────────────────
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

  // ── Postpay ───────────────────────────────────────────────
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

  const block = sharedBlocks.find(b => b.blockNumber === blockNumber);
  if (!block) {
    return { success: false, queryId, error: `Block #${blockNumber} not found in current window` };
  }

  // Build top contracts handling both formats
  let topContracts: any[] = [];
  if (Array.isArray(block.topFailingContracts)) {
    topContracts = block.topFailingContracts
      .sort((a: any, b: any) => b.failures - a.failures)
      .map((c: any) => ({ address: c.address, failures: c.failures }));
  } else if (block.topFailingContracts && typeof block.topFailingContracts === "object") {
    topContracts = Object.entries(block.topFailingContracts)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([addr, count]) => ({ address: addr, failures: count }));
  } else if (block.topFailing) {
    topContracts = Object.entries(block.topFailing)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([addr, count]) => ({ address: addr, failures: count }));
  }

  const data = {
    blockNumber:  block.blockNumber,
    totalTx:      block.totalTx,
    failedTx:     block.failedTx,
    failureRate:  `${(block.failureRate * 100).toFixed(2)}%`,
    severity:     block.failureRate >= 0.15 ? "CRITICAL" : block.failureRate >= 0.10 ? "HIGH" : "LOW",
    topContracts,
    timestamp:    new Date().toISOString(),
  };

  return handleQueryGate(walletAddress, mode, queryId, data);
}

// ── Confirm payment — works for ANY Arc Testnet wallet ────────
// On success: adds a paid credit so next query is served immediately
export async function confirmPayment(
  queryId:    string,
  txHashOrId: string,
  walletAddress: string
): Promise<IntelligenceResponse> {

  // ── Blockscout verification (any EVM wallet) ──────────────
  if (txHashOrId.startsWith("0x")) {
    const { confirmed } = await verifyExternalPayment(walletAddress);

    if (confirmed) {
      // Add credit — next query will be served immediately
      addPaidCredit(walletAddress);
      clearPendingPayment(walletAddress);

      const stats = getWalletStats(walletAddress);

      return {
        success: true,
        queryId,
        data: {
          message:     `Payment confirmed. 1 credit added to your wallet. Your next query will be served immediately.`,
          txHash:      txHashOrId,
          explorerUrl: `https://testnet.arcscan.app/tx/${txHashOrId}`,
          paidCredits: stats.paidCredits,
          totalSpent:  `${stats.totalSpent} USDC`,
        },
      };
    }

    return {
      success: false,
      queryId,
      error: "Payment not found on Arc Testnet. Make sure you sent 0.1 USDC to the service wallet and try again in a few seconds.",
    };
  }

  // ── Circle API verification fallback ─────────────────────
  const { confirmed } = await verifyPayment(txHashOrId);

  if (!confirmed) {
    return {
      success: false,
      queryId,
      error: "Payment not confirmed yet. Try again in a few seconds.",
    };
  }

  addPaidCredit(walletAddress);
  clearPendingPayment(walletAddress);

  const stats = getWalletStats(walletAddress);

  return {
    success: true,
    queryId,
    data: {
      message:     `Payment confirmed. 1 credit added to your wallet. Your next query will be served immediately.`,
      txId:        txHashOrId,
      paidCredits: stats.paidCredits,
      totalSpent:  `${stats.totalSpent} USDC`,
    },
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
      paidCredits:      stats.paidCredits || 0,
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
        "1 credit added per payment — used automatically on next query",
      ],
    },
  };
}