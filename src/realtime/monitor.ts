import { analyzeTransactions, AnalysisReport } from "../analysis/analyzer";
import { generateInsight } from "../utils/insightGenerator";

const SAMPLE_SIZE = 350;
const MIN_TX_THRESHOLD = 150;

export async function startMonitor(provider: any) {
  console.log("⚡ Starting ArcSense Realtime Monitor...\n");

  let lastBlock = await provider.getBlockNumber();

  const failureHistory: number[] = [];
  const contractMemory: Record<string, number> = {};

  while (true) {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (currentBlock > lastBlock) {
        for (let i = lastBlock + 1; i <= currentBlock; i++) {
          const block = await provider.getBlock(i, false);

          if (!block || !block.transactions) continue;

          const txs: string[] = block.transactions;

          if (txs.length < MIN_TX_THRESHOLD) continue;

          console.log(`\n🆕 Block ${i} → ${txs.length} tx`);

          const sampled = txs.slice(0, SAMPLE_SIZE);

          const report: AnalysisReport = await analyzeTransactions(
            sampled,
            (hash: string) => provider.getTransactionReceipt(hash)
          );

          // track history
          failureHistory.push(report.failureRate);
          if (failureHistory.length > 5) failureHistory.shift();

          // trend detection
          let trend = "Insufficient data";
          if (failureHistory.length >= 3) {
            const [a, b, c] = failureHistory.slice(-3);

            if (c > b && b > a) trend = "Failure rate rising";
            else if (c < b && b < a) trend = "Failures decreasing";
            else if (c === 0) trend = "Stable behavior";
            else trend = "Minor failure noise";
          }

          // contract memory aggregation
          for (const [addr, count] of report.topFailingContracts) {
            contractMemory[addr] =
              (contractMemory[addr] || 0) + count;
          }

          const insight = generateInsight(report, trend, contractMemory);

          // severity
          let severity = "NONE";
          if (report.failureRate > 0.2) severity = "HIGH";
          else if (report.failureRate > 0.05) severity = "MEDIUM";
          else if (report.failureRate > 0) severity = "LOW";

          console.log("📊 Report:", report);
          console.log("📈 Trend:", trend);
          console.log("🧠 Insight:", insight);
          console.log("🔥 Severity:", severity);
          console.log("🚨 Alerts:");

          if (severity === "HIGH") {
            console.log("⚠️ High failure spike detected");
          }
        }

        lastBlock = currentBlock;
      }

      await new Promise((res) => setTimeout(res, 3000));
    } catch (err) {
      console.error("Monitor error:", err);
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
}