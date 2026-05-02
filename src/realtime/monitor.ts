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
  const contractMemory: Record<string, number> = {};

  while (true) {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (currentBlock > lastBlock) {
        const block = await provider.getBlock(currentBlock);

        const txHashes: string[] = block.transactions;

        // 🔥 Ignore small blocks (<150 tx)
        if (txHashes.length < 150) {
          lastBlock = currentBlock;
          continue;
        }

        console.log(`🆕 Block ${currentBlock} → ${txHashes.length} tx\n`);

        // 🔥 Sample up to 350 tx
        const sampled = shuffleArray(txHashes).slice(0, 350);

        // 🔥 Batch processing (RPC safe)
        const BATCH_SIZE = 25;
        let reports: any[] = [];

        for (let i = 0; i < sampled.length; i += BATCH_SIZE) {
          const batch = sampled.slice(i, i + BATCH_SIZE);

          const results = await Promise.all(
            batch.map((txHash) =>
              analyzeTransactions([txHash], provider.getTransactionReceipt.bind(provider))
            )
          );

          reports.push(...results);

          await sleep(200); // throttle
        }

        // 🔥 Merge reports
        const report = {
          total: reports.reduce((sum, r) => sum + r.total, 0),
          successful: reports.reduce((sum, r) => sum + r.successful, 0),
          failed: reports.reduce((sum, r) => sum + r.failed, 0),
          failureRate:
            reports.reduce((sum, r) => sum + r.failed, 0) /
            reports.reduce((sum, r) => sum + r.total, 0),
          topFailingContracts: [],
          contractHistory: {},
        };

        // Merge contract failures
        for (const r of reports) {
          for (const [addr, count] of r.topFailingContracts) {
            report.contractHistory[addr] =
              (report.contractHistory[addr] || 0) + count;
          }
        }

        report.topFailingContracts = Object.entries(report.contractHistory)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 3);

        // 🔥 Track history
        failureHistory.push(report.failureRate);
        if (failureHistory.length > 10) failureHistory.shift();

        // 🔥 Update memory
        for (const [addr, count] of report.topFailingContracts) {
          contractMemory[addr] = (contractMemory[addr] || 0) + (count as number);
        }

        const trend = detectTrend(failureHistory);
        const insight = generateInsight(report, trend, contractMemory);
        const severity = getSeverity(report.failureRate, trend);

        console.log("📊 Report:", report);
        console.log("📈 Trend:", trend);
        console.log("🧠 Insight:", insight);
        console.log("🔥 Severity:", severity);
        console.log("🚨 Alerts:\n");

        lastBlock = currentBlock;
      }

      await sleep(3000);
    } catch (err) {
      console.error("❌ Monitor error:", err);
      await sleep(5000);
    }
  }
}