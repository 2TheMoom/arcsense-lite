import { getLatestBlockNumber, getBlockByNumber, getTransactionReceipt } from "./services/arcRpc";
import { parseTransactions } from "./services/transactionService";
import { analyzeTransactions } from "./services/analysisService";
import { analyzeTrend } from "./utils/trendAnalyzer";
import { generateInsights } from "./utils/insightGenerator";
import { generateAlerts } from "./utils/alertSystem";
import { generateXPost } from "./utils/xPostGenerator";
import { generateThread } from "./utils/threadGenerator";
import { saveReport } from "./storage/fileStorage";

async function main() {
  console.log("🚀 Running ArcSense Multi-Block...\n");

  const latestBlock = await getLatestBlockNumber();
  console.log("Latest Block:", latestBlock, "\n");

  const blocksToAnalyze = 5;
  let allTransactions: any[] = [];

  for (let i = 0; i < blocksToAnalyze; i++) {
    const blockNumber = latestBlock - i;
    const block = await getBlockByNumber(blockNumber);

    console.log(`🔍 Block ${blockNumber} → ${block.transactions.length} tx`);

    const parsed = parseTransactions(block.transactions);
    allTransactions = allTransactions.concat(parsed);
  }

  console.log("\n📊 Multi-Block Report\n");

  const analysis = await analyzeTransactions(
    allTransactions,
    getTransactionReceipt
  );

  const report = {
    total: analysis.total,
    successful: analysis.successful,
    failed: analysis.failed,
    failureRate: analysis.failureRate,
    topFailingContracts: analysis.topFailingContracts,
  };

  console.log("📊 ArcSense Report\n", report);

  // ✅ Trend (STRING)
  const trend = analyzeTrend(report);
  console.log("\n📈 Trend:", trend);

  // ✅ Insight
  const insight = generateInsights(report, trend);
  console.log("\n🧠 Insight:", insight);

  // ✅ Alerts
  const alerts = generateAlerts(report, trend);
  if (alerts.length) {
    console.log("\n🚨 Alerts:");
    alerts.forEach((a) => console.log(a));
  }

  // ✅ X Post (FIXED)
  const xPost = generateXPost(report);
  console.log("\n🐦 X Post:\n", xPost);

  // ✅ Thread (FIXED)
  const thread = generateThread(report);
  console.log("\n🧵 Thread:");
  thread.forEach((t) => console.log(t));

  // ✅ Save
  const saved = saveReport(report);
  console.log("\n💾 Saved:", saved);
}

main();