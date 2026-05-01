import { getLatestBlockNumber, getBlockByNumber, getTransactionReceipt } from "../services/arcRpc";
import { parseTransactions } from "../services/transactionService";
import { analyzeTransactions } from "../services/analysisService";
import { analyzeTrend } from "../utils/trendAnalyzer";
import { generateInsights } from "../utils/insightGenerator";
import { generateAlerts } from "../utils/alertSystem";
import { generateXPost } from "../utils/xPostGenerator";

let lastProcessedBlock = 0;

export async function startRealtimeMonitor() {
  console.log("⚡ Starting ArcSense Realtime Monitor...\n");

  setInterval(async () => {
    try {
      const latestBlock = await getLatestBlockNumber();

      if (latestBlock === lastProcessedBlock) return;

      const block = await getBlockByNumber(latestBlock);

      console.log(`\n🆕 New Block ${latestBlock} → ${block.transactions.length} tx`);

      const parsed = parseTransactions(block.transactions);

      const analysis = await analyzeTransactions(
        parsed,
        getTransactionReceipt
      );

      const report = {
        total: analysis.total,
        successful: analysis.successful,
        failed: analysis.failed,
        failureRate: analysis.failureRate,
        topFailingContracts: analysis.topFailingContracts,
      };

      const trend = analyzeTrend(report);
      const insight = generateInsights(report, trend);
      const alerts = generateAlerts(report, trend);

      console.log("\n📊 Realtime Report:", report);
      console.log("📈 Trend:", trend);
      console.log("🧠 Insight:", insight);

      if (alerts.length) {
        console.log("🚨 Alerts:");
        alerts.forEach((a) => console.log(a));
      }

      // ✅ FIXED
      const post = generateXPost(report);
      console.log("\n🐦 Realtime Signal:\n", post);

      lastProcessedBlock = latestBlock;
    } catch (err) {
      console.error("❌ Monitor error:", err);
    }
  }, 5000); // every 5s
}