// ── Decision thresholds ───────────────────────────────────────
const THRESHOLDS = {
  HEALTH_SCORE_BUY_CONTRACT_SCAN: 95,   // temporarily high
  FAILURE_RATE_BUY_BLOCK_ANALYSIS: 0.01, // temporarily low
  FAILURE_RATE_CRITICAL: 0.15,           // critical threshold
  MIN_BLOCKS_FOR_DECISION: 5,            // need at least 5 blocks to decide
};

// ── Types ─────────────────────────────────────────────────────
export type DecisionResult = {
  shouldPay:        boolean;
  action:           "CONTRACT_SCAN" | "BLOCK_ANALYSIS" | "NO_ACTION";
  reasoning:        string;
  targetContract:   string | null;
  targetBlock:      number | null;
  urgency:          "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

export type NetworkSnapshot = {
  healthScore:         number;
  status:              string;
  avgFailureRate:      string;
  blocksAnalyzed:      number;
  totalFailures:       number;
  topFailingContracts: { address: string; failures: number }[];
  latestBlock:         number | null;
};

// ── Core decision engine ──────────────────────────────────────
export function makeDecision(snapshot: NetworkSnapshot): DecisionResult {

  // Not enough data yet
  if (snapshot.blocksAnalyzed < THRESHOLDS.MIN_BLOCKS_FOR_DECISION) {
    return {
      shouldPay:      false,
      action:         "NO_ACTION",
      reasoning:      `Insufficient data — only ${snapshot.blocksAnalyzed} blocks analyzed. Need at least ${THRESHOLDS.MIN_BLOCKS_FOR_DECISION}.`,
      targetContract: null,
      targetBlock:    null,
      urgency:        "LOW",
    };
  }

  const failureRate = parseFloat(snapshot.avgFailureRate.replace("%", "")) / 100;
  const topContract = snapshot.topFailingContracts?.[0] || null;

  // ── CRITICAL: failure rate >= 15% + top contract exists ──
  if (failureRate >= THRESHOLDS.FAILURE_RATE_CRITICAL && topContract) {
    return {
      shouldPay:      true,
      action:         "CONTRACT_SCAN",
      reasoning:      `CRITICAL failure rate of ${snapshot.avgFailureRate} detected. Top contract ${topContract.address} has ${topContract.failures} failures. Buying deep contract risk scan.`,
      targetContract: topContract.address,
      targetBlock:    snapshot.latestBlock,
      urgency:        "CRITICAL",
    };
  }

  // ── HIGH: health score dropped below threshold ────────────
  if (snapshot.healthScore < THRESHOLDS.HEALTH_SCORE_BUY_CONTRACT_SCAN && topContract) {
    return {
      shouldPay:      true,
      action:         "CONTRACT_SCAN",
      reasoning:      `Health score dropped to ${snapshot.healthScore}/100 — below safe threshold of ${THRESHOLDS.HEALTH_SCORE_BUY_CONTRACT_SCAN}. Purchasing contract intelligence for top offender ${topContract.address}.`,
      targetContract: topContract.address,
      targetBlock:    snapshot.latestBlock,
      urgency:        "HIGH",
    };
  }

  // ── MEDIUM: failure rate >= 10% ───────────────────────────
  if (failureRate >= THRESHOLDS.FAILURE_RATE_BUY_BLOCK_ANALYSIS && snapshot.latestBlock) {
    return {
      shouldPay:      true,
      action:         "BLOCK_ANALYSIS",
      reasoning:      `Elevated failure rate of ${snapshot.avgFailureRate} detected on block #${snapshot.latestBlock}. Purchasing block analysis to identify root cause.`,
      targetContract: topContract?.address || null,
      targetBlock:    snapshot.latestBlock,
      urgency:        "MEDIUM",
    };
  }

  // ── LOW: network healthy — no action needed ───────────────
  return {
    shouldPay:      false,
    action:         "NO_ACTION",
    reasoning:      `Network operating normally. Health score: ${snapshot.healthScore}/100. Failure rate: ${snapshot.avgFailureRate}. No intelligence purchase needed.`,
    targetContract: null,
    targetBlock:    null,
    urgency:        "LOW",
  };
}

// ── Format decision for logging ───────────────────────────────
export function formatDecisionSummary(decision: DecisionResult): string {
  const icons: Record<string, string> = {
    CRITICAL: "🔴",
    HIGH:     "🟠",
    MEDIUM:   "🟡",
    LOW:      "🟢",
  };

  const icon = icons[decision.urgency] || "⚪";

  if (!decision.shouldPay) {
    return `${icon} NO ACTION — ${decision.reasoning}`;
  }

  return `${icon} ${decision.action} — ${decision.reasoning}`;
}

export { THRESHOLDS };