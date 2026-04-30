import {
  getBlockNumber,
  getBlockByNumber,
  getTransactionReceipt,
} from "./services/arcRpc";

import { parseTransactions } from "./services/transactionService";
import { analyzeTransactions } from "./services/analysisService";
import { generateReport } from "./reports/reportGenerator";

async function run() {
  try {
    console.log("🚀 Running ArcSense...\n");

    const latestBlock = await getBlockNumber();
    console.log("Latest Block:", latestBlock);

    const block = await getBlockByNumber(latestBlock);

    // ✅ Limit to 20 transactions (faster)
    const transactions = parseTransactions(block).slice(0, 50);

    console.log(`Checking ${transactions.length} transactions...\n`);

    const stats = await analyzeTransactions(
      transactions,
      getTransactionReceipt
    );

    const report = generateReport(stats);

    console.log(report);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
  }
}

run();