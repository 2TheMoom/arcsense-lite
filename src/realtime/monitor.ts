import { getLatestBlock, getTransactionReceipt } from "../services/arcRpc";
import { getBlockTransactions } from "../services/transactionService";
import { analyzeTransactions } from "../services/analysisService";

import { generateTrend } from "../utils/trendAnalyzer";
import { generateInsight } from "../utils/insightGenerator";
import { generateXPost } from "../utils/xPostGenerator";
import { generateThread } from "../utils/threadGenerator";
import { generateAlerts } from "../utils/alertSystem";

let lastFailureRate = 0;

async function monitor() {
  console.log("⚡ Starting ArcSense Realtime Monitor...\n");

  while (true) {
    try {
      const block = await getLatestBlock();
      const txs = await getBlockTransactions(block);

      console.log(`\n🆕 Block ${block.number} → ${txs.length} tx`);

      if (!txs.length) continue;

      const report = await analyzeTransactions(
        txs,
        getTransactionReceipt
      );

      const trend = generateTrend(lastFailureRate, report.failureRate);
      const insight = generateInsight(report, trend);
      const alerts = generateAlerts(report, trend);

      console.log("\n📊 Report:", report);
      console.log("📈 Trend:", trend);
      console.log("🧠 Insight:", insight);

      if (alerts.length > 0) {
        console.log("🚨 Alerts:");
        alerts.forEach((a) => console.log(a));
      }

      const post = generateXPost(report, trend, insight);
      console.log("\n🐦 Realtime Signal:\n", post);

      const thread = generateThread(report, trend, insight);
      if (thread) {
        console.log("\n🧵 Thread:\n", thread);
      }

      lastFailureRate = report.failureRate;

      await new Promise((res) => setTimeout(res, 3000));
    } catch (err) {
      console.log("⚠️ Error in monitor loop:", err);
    }
  }
}

monitor();