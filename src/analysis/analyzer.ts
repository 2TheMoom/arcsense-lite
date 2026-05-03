import { Tx } from "../types";

// persistent contract history across blocks
const contractHistory: Record<string, number> = {};

// track previous failure rate for trend
let lastFailureRate = 0;

export function analyzeBlock(blockNumber: number, transactions: Tx[]) {
  // 🔥 Dynamic sample size (60% of block, capped)
  const SAMPLE_SIZE = Math.min(
    Math.max(Math.floor(transactions.length * 0.6), 100),
    300
  );

  const sample = transactions.slice(0, SAMPLE_SIZE);

  let failures = 0;
  const contractFailures: Record<string, number> = {};

  for (const tx of sample) {
    if (tx.status === 0) {
      failures++;

      if (tx.to) {
        contractFailures[tx.to] =
          (contractFailures[tx.to] || 0) + 1;

        // update global history
        contractHistory[tx.to] =
          (contractHistory[tx.to] || 0) + 1;
      }
    }
  }

  const failureRate = (failures / sample.length) * 100;

  // 📈 Trend logic
  let trend = "Stable";
  if (failureRate > lastFailureRate + 1) {
    trend = "Increasing failures detected";
  } else if (failureRate < lastFailureRate - 1) {
    trend = "Decreasing failures";
  }

  lastFailureRate = failureRate;

  // 🔥 Top contracts (current block)
  const topContracts = Object.entries(contractFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // 🧠 Historical offenders
  const historicalTop = Object.entries(contractHistory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // 🚨 Severity
  let severity = "LOW";
  if (failureRate > 10) severity = "HIGH";
  else if (failureRate > 5) severity = "MEDIUM";

  // 🧠 Insight
  let insight = "Normal network activity";
  if (failureRate > 10) {
    insight = "High failure spike — possible contract issue or exploit";
  } else if (failureRate > 5) {
    insight = "Elevated failure rate — monitor closely";
  } else if (topContracts.length > 0) {
    insight = "Minor contract-specific failures detected";
  }

  // 🚨 Alert (LAST LINE)
  let alert = "";
  if (failureRate > 10) {
    alert = "🚨 ALERT: Abnormal failure spike detected!";
  }

  // 🖨 OUTPUT
  console.log(`\n📊 Block ${blockNumber} Analysis`);
  console.log("────────────────────────");
  console.log(`Tx Analyzed: ${sample.length}`);
  console.log(
    `Failures: ${failures} (${failureRate.toFixed(2)}%)`
  );

  console.log("\n🔥 Top Contracts:");
  if (topContracts.length === 0) {
    console.log("- None");
  } else {
    topContracts.forEach(([addr, count]) => {
      console.log(`- ${addr} → ${count} failures`);
    });
  }

  console.log("\n📚 Contract History:");
  if (historicalTop.length === 0) {
    console.log("- None");
  } else {
    historicalTop.forEach(([addr, count]) => {
      console.log(`- ${addr} → ${count} total failures`);
    });
  }

  console.log(`\n📈 Trend: ${trend}`);
  console.log(`⚠️ Severity: ${severity}`);
  console.log(`🧠 Insight: ${insight}`);

  if (alert) {
    console.log(`\n${alert}`);
  }

  console.log("\n");
}