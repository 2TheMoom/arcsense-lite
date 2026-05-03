import {
  updateContractStats,
  getTopContracts,
  computeTrend,
} from "./state";

type Receipt = {
  to: string | null;
  status: number | null;
};

export function analyzeBlock(blockNumber: number, receipts: Receipt[]) {
  const totalTx = receipts.length;

  let failures = 0;
  const contractFailures: Record<string, number> = {};

  for (const r of receipts) {
    const success = r.status === 1;

    if (!success) {
      failures++;

      if (r.to) {
        contractFailures[r.to] = (contractFailures[r.to] || 0) + 1;
      }
    }

    // ✅ use new state system
    updateContractStats(r.to, success);
  }

  const failureRate = totalTx === 0 ? 0 : (failures / totalTx) * 100;

  const trend = computeTrend(failureRate);

  // ⚠️ Severity
  let severity = "LOW";
  if (failureRate > 10) severity = "HIGH";
  else if (failureRate > 5) severity = "MEDIUM";

  // 🧠 Insight
  let insight = "Normal network activity";
  if (severity === "MEDIUM") {
    insight = "Elevated failure rate — monitor closely";
  } else if (severity === "HIGH") {
    insight = "High failure rate detected — possible incident";
  } else if (failures > 0) {
    insight = "Minor contract-specific failures detected";
  }

  // 🔥 Top contracts (current block)
  const topContracts = Object.entries(contractFailures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // 📚 Global history
  const history = getTopContracts(3);

  // 🖨️ Output
  console.log(`\n📊 Block ${blockNumber} Analysis`);
  console.log("────────────────────────");
  console.log(`Tx Analyzed: ${totalTx}`);
  console.log(`Failures: ${failures} (${failureRate.toFixed(2)}%)\n`);

  console.log("🔥 Top Contracts:");
  if (topContracts.length === 0) console.log("- None");
  else {
    for (const [addr, count] of topContracts) {
      console.log(`- ${addr} → ${count} failures`);
    }
  }

  console.log("\n📚 Contract History:");
  if (history.length === 0) console.log("- None");
  else {
    for (const c of history) {
      console.log(`- ${c.address} → ${c.totalFailures} total failures`);
    }
  }

  console.log(`\n📈 Trend: ${trend}`);
  console.log(`⚠️ Severity: ${severity}`);
  console.log(`🧠 Insight: ${insight}`);

  // 🚨 Alert (last line)
  if (severity === "HIGH") {
    console.log(
      `🚨 Alert: Failure rate exceeded threshold (${failureRate.toFixed(2)}%)`
    );
  }

  console.log("\n");
}