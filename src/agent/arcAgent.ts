import * as crypto from "crypto";
import * as https from "https";
import {
  logDecision,
  incrementCycle,
  setAgentStatus,
  getAgentStats,
  getRecentDecisions,
  getFullLog,
  type AgentStats,
  type AgentDecision,
} from "./agentLogger";
import {
  makeDecision,
  formatDecisionSummary,
  type NetworkSnapshot,
} from "./agentDecision";
import {
  payForIntelligence,
  getAgentBalance,
  getOnChainTxHash,
  AGENT_WALLET_ADDRESS,
} from "./agentWallet";
import {
  queryContractIntelligence,
  queryBlockAnalysis,
} from "../api/intelligenceApi";

// ── Config ────────────────────────────────────────────────────
const AGENT_WALLET      = process.env.CIRCLE_AGENT_WALLET_ADDRESS!;
const REPORTS_URL       = "https://arcsense-lite-production.up.railway.app/reports";
const SCHEDULE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PAYMENT_MODE      = "prepay" as const;

// ── Agent state ───────────────────────────────────────────────
let isRunning       = false;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let currentCycle    = 0;

// ── Direct health fetch — bypasses payment gate entirely ──────
// Reads from /reports directly so agent never consumes free queries
async function fetchNetworkHealthDirect(): Promise<{
  success: boolean;
  data?: NetworkSnapshot & {
    totalTransactions: number;
    timestamp: string;
  };
  error?: string;
}> {
  return new Promise((resolve) => {
    https.get(REPORTS_URL, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          const json    = JSON.parse(raw);
          const reports = Array.isArray(json) ? json : (json.reports || []);
          const recent  = reports.slice(-30);

          if (recent.length === 0) {
            resolve({ success: false, error: "No block data available yet" });
            return;
          }

          const totalTx  = recent.reduce((s: number, b: any) => s + (b.totalTx || 0), 0);
          const failed   = recent.reduce((s: number, b: any) => s + (b.failedTx || 0), 0);
          const avgRate  = recent.reduce((s: number, b: any) => s + (b.failureRate || 0), 0) / recent.length;
          const health   = Math.max(0, Math.round(100 - avgRate * 400));
          const latest   = reports[reports.length - 1];

          // Build top failing contracts from recent blocks
          const contractMap: Record<string, number> = {};
          for (const b of recent) {
            for (const [addr, count] of Object.entries(b.topFailingContracts || {})) {
              contractMap[addr] = (contractMap[addr] || 0) + (count as number);
            }
          }

          const topFailingContracts = Object.entries(contractMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([address, failures]) => ({ address, failures }));

          resolve({
            success: true,
            data: {
              healthScore:         health,
              status:              health >= 80 ? "HEALTHY" : health >= 50 ? "DEGRADED" : "CRITICAL",
              avgFailureRate:      `${(avgRate * 100).toFixed(2)}%`,
              blocksAnalyzed:      recent.length,
              totalFailures:       failed,
              totalTransactions:   totalTx,
              topFailingContracts,
              latestBlock:         latest?.blockNumber || null,
              timestamp:           new Date().toISOString(),
            },
          });
        } catch (e: any) {
          resolve({ success: false, error: e.message });
        }
      });
    }).on("error", (e) => {
      resolve({ success: false, error: e.message });
    });
  });
}

// ── Core agent cycle ──────────────────────────────────────────
export async function runAgentCycle(): Promise<{
  cycleNumber: number;
  decision:    AgentDecision;
  balance:     number;
}> {
  if (isRunning) {
    console.log("⚠️  Agent cycle already running — skipping");
    return {
      cycleNumber: currentCycle,
      decision:    getRecentDecisions(1)[0],
      balance:     0,
    };
  }

  isRunning = true;
  setAgentStatus("RUNNING");
  currentCycle = incrementCycle();

  console.log(`\n🤖 ═══ Agent Cycle #${currentCycle} started ═══`);

  try {
    // ── Step 1: Check agent balance ──────────────────────────
    const balance = await getAgentBalance();
    console.log(`💰 Agent balance: ${balance} USDC`);

    // ── Step 2: Fetch network health directly (free, no query gate)
    console.log(`📡 Fetching network health directly from /reports...`);
    const healthResponse = await fetchNetworkHealthDirect();

    if (!healthResponse.success || !healthResponse.data) {
      const decision = logDecision({
        type:        "ERROR",
        reasoning:   `Failed to fetch network health: ${healthResponse.error}`,
        action:      "Skipped cycle — no data available",
        paid:        false,
        amountPaid:  0,
        txId:        null,
        data:        healthResponse,
        cycleNumber: currentCycle,
      });

      isRunning = false;
      setAgentStatus("IDLE");
      return { cycleNumber: currentCycle, decision, balance };
    }

    // ── Step 3: Build network snapshot ───────────────────────
    const snapshot: NetworkSnapshot = {
      healthScore:         healthResponse.data.healthScore,
      status:              healthResponse.data.status,
      avgFailureRate:      healthResponse.data.avgFailureRate,
      blocksAnalyzed:      healthResponse.data.blocksAnalyzed,
      totalFailures:       healthResponse.data.totalFailures,
      topFailingContracts: healthResponse.data.topFailingContracts || [],
      latestBlock:         healthResponse.data.latestBlock,
    };

    console.log(`📊 Network: ${snapshot.status} | Health: ${snapshot.healthScore}/100 | Failures: ${snapshot.avgFailureRate} | Blocks: ${snapshot.blocksAnalyzed}`);

    // ── Step 4: Make decision ─────────────────────────────────
    const decision = makeDecision(snapshot);
    console.log(`🧠 Decision: ${formatDecisionSummary(decision)}`);

    // ── Step 5: No action needed ──────────────────────────────
    if (!decision.shouldPay) {
      const logged = logDecision({
        type:        "NO_ACTION",
        reasoning:   decision.reasoning,
        action:      "Network within acceptable parameters — no purchase needed",
        paid:        false,
        amountPaid:  0,
        txId:        null,
        data:        { snapshot, decision },
        cycleNumber: currentCycle,
      });

      isRunning = false;
      setAgentStatus("IDLE");
      return { cycleNumber: currentCycle, decision: logged, balance };
    }

    // ── Step 6: Check balance ─────────────────────────────────
    if (balance < 0.1) {
      const logged = logDecision({
        type:        "PAYMENT_FAILED",
        reasoning:   `Insufficient balance: ${balance} USDC. Need 0.1 USDC.`,
        action:      "Skipped intelligence purchase — low balance",
        paid:        false,
        amountPaid:  0,
        txId:        null,
        data:        { snapshot, decision, balance },
        cycleNumber: currentCycle,
      });

      isRunning = false;
      setAgentStatus("IDLE");
      return { cycleNumber: currentCycle, decision: logged, balance };
    }

    // ── Step 7: Send payment ──────────────────────────────────
    const queryId       = crypto.randomUUID();
    const paymentResult = await payForIntelligence(queryId);

    if (!paymentResult.success || !paymentResult.txId) {
      const logged = logDecision({
        type:        "PAYMENT_FAILED",
        reasoning:   `Payment failed: ${paymentResult.error}`,
        action:      "Intelligence purchase failed — payment rejected",
        paid:        false,
        amountPaid:  0,
        txId:        null,
        data:        { snapshot, decision, paymentResult },
        cycleNumber: currentCycle,
      });

      isRunning = false;
      setAgentStatus("IDLE");
      return { cycleNumber: currentCycle, decision: logged, balance };
    }

    console.log(`✅ Payment accepted by Circle: ${paymentResult.txId}`);

    // ── Step 8: Fetch real on-chain hash via Blockscout ───────
    const txHash      = await getOnChainTxHash(AGENT_WALLET_ADDRESS);
    const explorerUrl = txHash
      ? `https://testnet.arcscan.app/tx/${txHash}`
      : `https://testnet.arcscan.app/address/${AGENT_WALLET_ADDRESS}`;

    console.log(`🔗 Arc Explorer: ${explorerUrl}`);

    // Log payment sent
    logDecision({
      type:        "PAYMENT_SENT",
      reasoning:   `Payment of 0.1 USDC sent to ArcSense service wallet`,
      action:      `Sent 0.1 USDC — tx: ${txHash || paymentResult.txId}`,
      paid:        true,
      amountPaid:  0.1,
      txId:        txHash || paymentResult.txId,
      data:        { snapshot, decision, paymentResult, explorerUrl },
      cycleNumber: currentCycle,
    });

    // ── Step 9: Fetch paid intelligence ───────────────────────
    let intelligenceData: any = null;

    if (decision.action === "CONTRACT_SCAN" && decision.targetContract) {
      const result = await queryContractIntelligence(
        decision.targetContract,
        AGENT_WALLET,
        PAYMENT_MODE
      );
      intelligenceData = result.data;
      console.log(`🔍 Contract scan complete: ${decision.targetContract}`);
      console.log(`   Risk: ${intelligenceData?.riskLevel} | Score: ${intelligenceData?.riskScore}`);
    }

    if (decision.action === "BLOCK_ANALYSIS" && decision.targetBlock) {
      const result = await queryBlockAnalysis(
        decision.targetBlock,
        AGENT_WALLET,
        PAYMENT_MODE
      );
      intelligenceData = result.data;
      console.log(`📦 Block analysis complete: #${decision.targetBlock}`);
      console.log(`   Severity: ${intelligenceData?.severity}`);
    }

    // ── Step 10: Log final decision ───────────────────────────
    const logged = logDecision({
      type:        decision.action === "CONTRACT_SCAN" ? "CONTRACT_SCAN" : "BLOCK_ANALYSIS",
      reasoning:   decision.reasoning,
      action:      `Paid 0.1 USDC for ${decision.action} — ${
        decision.action === "CONTRACT_SCAN"
          ? `Risk: ${intelligenceData?.riskLevel || "UNKNOWN"}`
          : `Severity: ${intelligenceData?.severity || "UNKNOWN"}`
      }`,
      paid:        true,
      amountPaid:  0.1,
      txId:        txHash || paymentResult.txId,
      data:        {
        snapshot,
        decision,
        intelligence: intelligenceData,
        explorerUrl,
      },
      cycleNumber: currentCycle,
    });

    console.log(`✅ Cycle #${currentCycle} complete`);
    console.log(`🤖 ═══════════════════════════════════════\n`);

    isRunning = false;
    setAgentStatus("IDLE");
    return { cycleNumber: currentCycle, decision: logged, balance };

  } catch (err: any) {
    console.error(`❌ Agent cycle error:`, err.message);

    const logged = logDecision({
      type:        "ERROR",
      reasoning:   err.message,
      action:      "Cycle failed with unexpected error",
      paid:        false,
      amountPaid:  0,
      txId:        null,
      data:        { error: err.message },
      cycleNumber: currentCycle,
    });

    isRunning = false;
    setAgentStatus("ERROR");
    return { cycleNumber: currentCycle, decision: logged, balance: 0 };
  }
}

// ── Scheduler ─────────────────────────────────────────────────
export function startAgentScheduler(): void {
  if (schedulerHandle) {
    console.log("⚠️  Agent scheduler already running");
    return;
  }

  console.log(`⚡ Agent scheduler started — running every ${SCHEDULE_INTERVAL / 60000} minutes`);

  // Run immediately on start
  runAgentCycle().catch(console.error);

  // Then on schedule
  schedulerHandle = setInterval(() => {
    runAgentCycle().catch(console.error);
  }, SCHEDULE_INTERVAL);
}

export function stopAgentScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
    setAgentStatus("IDLE");
    console.log("🛑 Agent scheduler stopped");
  }
}

// ── Status and log accessors ──────────────────────────────────
export function getAgentStatus(): AgentStats {
  return getAgentStats();
}

export function getAgentLog(limit = 20): AgentDecision[] {
  return getRecentDecisions(limit);
}

export function getAgentFullLog() {
  return getFullLog();
}