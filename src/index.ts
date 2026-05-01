import {
  getBlockNumber,
  getBlockByNumber,
  getTransactionReceipt,
} from "./services/arcRpc";

import { parseTransactions } from "./services/transactionService";
import { analyzeTransactions } from "./services/analysisService";
import { generateReport } from "./reports/reportGenerator";
import { saveReport } from "./storage/fileStorage";

import { analyzeTrend } from "./utils/trendAnalyzer";
import { generateInsights } from "./utils/insightGenerator"; // ✅ fixed name
import { generateXPost } from "./utils/xPostGenerator";
import { generateThread } from "./utils/threadGenerator";

async function runArcSense() {
  try {
    console.log("🚀 Running ArcSense Multi-Block...\n");

    const latestBlock = await getBlockNumber();
    console.log(`Latest Block: ${latestBlock}\n`);

    const BLOCKS_TO_SCAN = 5;
    let allTransactions: any[] = [];

    for (let i = 0; i < BLOCKS_TO_SCAN; i++) {
      const blockNumber = latestBlock - i;
      const block = await getBlockByNumber(blockNumber);

      if (!block || !block.transactions) continue;

      console.log(`🔍 Block ${blockNumber} → ${block.transactions.length} tx`);
      allTransactions.push(...block.transactions);
    }

    // Parse
    const parsed = parseTransactions(allTransactions);

    // Analyze (IMPORTANT: await + pass receipt fn)
    const analysis = await analyzeTransactions(
      parsed,
      getTransactionReceipt
    );

    const reportData = {
      blocksAnalyzed: BLOCKS_TO_SCAN,
      totalTransactions: parsed.length,
      totalFailed: analysis.failed,
      avgFailureRate:
        parsed.length === 0 ? 0 : analysis.failed / parsed.length,
      topFailingContracts: analysis.topFailingContracts,
    };

    // Report
    const reportText = generateReport(reportData);

    console.log("\n📊 Multi-Block Report\n");
    console.log(reportText);

    // Save (ONLY ONE ARG)
    const saved = saveReport(reportData);

    console.log("\n💾 Reports saved:");
    console.log(saved.jsonPath);
    console.log(saved.txtPath);

    // Trend (RETURNS STRING — not object)
    const trend = analyzeTrend(reportData);

    console.log("\n📈 Trend Analysis\n");
    console.log(trend); // ✅ fixed (no .summary)

    // Insights
    const insight = generateInsights(reportData, trend);

    console.log("\n🧠 ArcSense Insight\n");
    console.log(insight);

    // X Post
    const xPost = generateXPost(reportData);

    console.log("\n🐦 X Post Preview:\n");
    console.log(xPost);

    // Thread (RETURNS STRING — not array)
    const thread = generateThread(reportData);

    console.log("\n🧵 Thread Preview:\n");
    console.log(thread); // ✅ fixed (no .forEach)

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

runArcSense();