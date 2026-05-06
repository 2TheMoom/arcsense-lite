import {
  getTrend,
  getContractHistory,
} from "../storage/stateStorage";

type BlockReport = {
  blockNumber: number;
  totalTx: number;
  failedTx: number;
  failureRate: number;
  topFailingContracts: Record<string, number>;
};

export function pushBlockReport(report: BlockReport) {
  const success = report.totalTx - report.failedTx;

  console.log(
    `\n📦 Block ${report.blockNumber} → ${report.totalTx} tx`
  );

  console.log("\n📊 Report: {");
  console.log(`  total: ${report.totalTx},`);
  console.log(`  successful: ${success},`);
  console.log(`  failed: ${report.failedTx},`);
  console.log(
    `  failureRate: ${report.failureRate.toFixed(2)},`
  );

  // 🔥 topFailingContracts
  console.log("  topFailingContracts: [");
  const entries = Object.entries(report.topFailingContracts);
  if (entries.length === 0) {
    console.log("  ],");
  } else {
    for (const [addr, count] of entries) {
      console.log(`    '${addr}', ${count}`);
    }
    console.log("  ],");
  }
  console.log("}");

  // 🔥 CONTRACT HISTORY (GLOBAL)
  const history = getContractHistory();
  console.log("\ncontractHistory: {");
  for (const [addr, count] of Object.entries(history)) {
    console.log(`  '${addr}', ${count}`);
  }
  console.log("}");

  // 🔥 TREND
  const trend = getTrend();
  console.log(`\n📈 Trend: ${trend}`);

  // 🔥 INSIGHT + SEVERITY
  let insight = "Failure activity increasing across recent blocks";
  let severity = "LOW";

  if (report.failureRate > 0.15) {
    insight = "Elevated failure rate detected across multiple transactions";
    severity = "HIGH";
  } else if (report.failureRate >= 0.10) {
    insight = "Moderate failure activity detected";
    severity = "MEDIUM";
  } else {
    insight = "Failure activity increasing across recent blocks";
    severity = "LOW";
  }

  console.log(`🧠 Insight: ${insight}`);
  console.log(`🚨 Severity: ${severity}`);

  // 🚨 ALERT SYSTEM — triggers at 10% failure rate and above
  if (report.failureRate >= 0.10) {
    const topContract = entries.length > 0 ? entries[0][0] : null;
    const spikePercent = (report.failureRate * 100).toFixed(0);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚨 ALERT TRIGGERED`);
    console.log(`=`.repeat(60));

    if (report.failureRate >= 0.15) {
      console.log(`⛔  CRITICAL: Severe failure spike — ${spikePercent}% of transactions failed`);
    } else {
      console.log(`⚠️  WARNING: Abnormal failure spike — ${spikePercent}% of transactions failed`);
    }

    console.log(`📦 Block: #${report.blockNumber}`);
    console.log(`📉 Failed: ${report.failedTx} of ${report.totalTx} transactions`);

    if (topContract) {
      console.log(`🎯 Most active failing contract: ${topContract}`);
    }

    console.log(`${"=".repeat(60)}`);
  }
}