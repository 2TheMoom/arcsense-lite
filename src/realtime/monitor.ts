// src/realtime/monitor.ts

import { analyzeTransactions } from "../analysis/analyzer";
import { detectTrend } from "../utils/trendDetector";
import { generateInsight } from "../utils/insightGenerator";
import { getSeverity } from "../utils/severity";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Shuffle helper
function shuffleArray<T>(array: T[]): T[] {
  return array
    .map((a) => ({ sort: Math.random(), value: a }))
    .sort((a, b) => a.sort - b.sort)
    .map((a) => a.value);
}

export async function startMonitor(provider: any) {
  console.log("⚡ Starting ArcSense Realtime Monitor...\n");

  let lastBlock = await provider.getBlockNumber();

  const failureHistory: number[] = [];

  // ✅ FIXED: contract memory defined here
  const contractMemory: Record<string, number> = {};

  while (true) {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (currentBlock > lastBlock) {
        for (let i = lastBlock + 1; i <= currentBlock; i++) {
          const block = await provider.getBlock(i, false);

          if (!block || !block.transactions) continue;

          console.log(
            `\n🆕 Block ${i} → ${block.transactions.length} tx`
          );

          // ✅ FIXED: ensure string[]
          const txHashes: string[] = block.transactions.map(
            (tx: any) => (typeof tx === "string" ? tx : tx.hash)
          );

          // sample max 50 tx
          const sampled: string[] = shuffleArray(txHashes).slice(0, 50);

          // analyze
          const report = await analyzeTransactions(
            sampled,
            provider.getTransactionReceipt.bind(provider)
          );

          // track history
          failureHistory.push(report.failureRate);
          if (failureHistory.length > 10) failureHistory.shift();

          // trend
          const trend = detectTrend(failureHistory);

          // ✅ FIXED: update contract memory
          for (const [addr, count] of report.topFailingContracts) {
            contractMemory[addr] =
              (contractMemory[addr] || 0) + count;
          }

          // insight
          const insight = generateInsight(
            report,
            trend,
            contractMemory
          );

          // severity
          const severity = getSeverity(
            report.failureRate,
            trend
          );

          // output
          console.log("\n📊 Report:", report);
          console.log("📈 Trend:", trend);
          console.log("🧠 Insight:", insight);
          console.log("🔥 Severity:", severity);

          // alerts
          console.log("🚨 Alerts:");

          if (severity === "HIGH") {
            console.log("🚨 High failure rate detected!");
          }

          if (trend.includes("rising")) {
            console.log("📈 Failure trend increasing");
          }
        }

        lastBlock = currentBlock;
      }

      await sleep(3000);
    } catch (err) {
      console.error("❌ Monitor error:", err);
      await sleep(5000);
    }
  }
}