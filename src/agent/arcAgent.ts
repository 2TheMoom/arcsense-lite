import * as crypto from "crypto";
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
} from "./agentWallet";
import {
  queryNetworkHealth,
  queryContractIntelligence,
  queryBlockAnalysis,
} from "../api/intelligenceApi";

// ── Config ────────────────────────────────────────────────────
const AGENT_WALLET      = process.env.CIRCLE_AGENT_WALLET_ADDRESS!;
const SCHEDULE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PAYMENT_MODE      = "prepay" as const;

// ── Agent state ───────────────────────────────────────────────
let isRunning       = false;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let currentCycle    = 0;

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

    // ── Step 2: Fetch network health (free tier) ─────────────
    const healthResponse = await queryNetworkHealth(AGENT_WALLET, "prepay");

    if (!healthResponse.success || !healthResponse.data) {
      const decision = logDecision({
        type:        "ERROR",
        reasoning:   "Failed to fetch network health from intelligence API",
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

    console.log(`📊 Network: ${snapshot.status} | Health: ${snapshot.healthScore}/100 | Failures: ${snapshot.avgFailureRate}`);

    // ── Step 4: Make decision ─────────────────────────────────
    const decision = makeDecision(snapshot);
    console.log(`🧠 Decision: ${formatDecisionSummary(decision)}`);

    // ── Step 5: No action needed ──────────────────────────────
    if (!decision.shouldPay) {
      const logged = logDecision({
        type:        "NO_ACTION",
        reasoning:   decision.reasoning,
        action:      "Network healthy — no intelligence purchase needed",
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
    const queryId      = crypto.randomUUID();
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

    // ── Step 8: Payment accepted — proceed immediately ────────
    // Circle API on Arc Testnet has indexing delays — we trust the
    // accepted txId as proof of payment. Balance reduction confirms it.
    console.log(`✅ Payment accepted by Circle: ${paymentResult.txId}`);
    console.log(`   Arc Explorer: https://testnet.arcscan.app/tx/${paymentResult.txId}`);

    // Log payment confirmation
    logDecision({
      type:        "PAYMENT_SENT",
      reasoning:   `Payment of 0.1 USDC accepted by Circle API`,
      action:      `Sent 0.1 USDC — tx: ${paymentResult.txId}`,
      paid:        true,
      amountPaid:  0.1,
      txId:        paymentResult.txId,
      data:        { snapshot, decision, paymentResult },
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
      txId:        paymentResult.txId,
      data:        {
        snapshot,
        decision,
        intelligence:  intelligenceData,
        explorerUrl:   `https://testnet.arcscan.app/tx/${paymentResult.txId}`,
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