import {
  getBlockNumber,
  getBlockByNumber,
  getTransactionReceipt,
} from "./services/arcRpc";

import { parseTransactions } from "./services/transactionService";
import { analyzeTransactions } from "./services/analysisService";
import { saveReport } from "./storage/fileStorage";
import { analyzeTrend } from "./utils/trendAnalyzer";

async function run() {
  try {
    console.log("🚀 Running ArcSense Multi-Block...\n");

    const latestBlock = await getBlockNumber();
    console.log("Latest Block:", latestBlock);

    const BLOCK_RANGE = 5;

    let totalTx = 0;
    let totalFailed = 0;

    const globalFailureMap: Record<string, number> = {};

    for (let i = 0; i < BLOCK_RANGE; i++) {
      const blockNumber = latestBlock - i;

      const block = await getBlockByNumber(blockNumber);
      const transactions = parseTransactions(block).slice(0, 50);

      console.log(`\n🔍 Block ${blockNumber} → ${transactions.length} tx`);

      const stats = await analyzeTransactions(
        transactions,
        getTransactionReceipt
      );

      totalTx += stats.total;
      totalFailed += stats.failed;

      // merge contract failures
      stats.topFailingContracts.forEach(
        ([address, count]: [string, number]) => {
          if (!globalFailureMap[address]) {
            globalFailureMap[address] = 0;
          }
          globalFailureMap[address] += count;
        }
      );
    }

    const avgFailureRate = totalTx === 0 ? 0 : totalFailed / totalTx;

    const topFailingContracts = Object.entries(globalFailureMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // 📊 Console Report
    console.log(`
📊 Multi-Block Report

Blocks Analyzed: ${BLOCK_RANGE}
Total Transactions: ${totalTx}
Total Failed: ${totalFailed}
Avg Failure Rate: ${(avgFailureRate * 100).toFixed(2)}%

Top Failing Contracts:
`);

    topFailingContracts.forEach(([addr, count]) => {
      console.log(`- ${addr} → ${count} failures`);
    });

    if (topFailingContracts.length === 0) {
      console.log("No failing contracts detected.");
    }

    // 💾 Prepare report data
    const reportData = {
      blocks: BLOCK_RANGE,
      totalTx,
      totalFailed,
      avgFailureRate,
      topFailingContracts,
    };

    // 💾 Save report
    saveReport(reportData);

    // 📈 Trend Analysis
    const trend = analyzeTrend(reportData);
    console.log(trend);

  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
  }
}

run();