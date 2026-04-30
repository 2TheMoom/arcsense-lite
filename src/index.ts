import { getBlockNumber, getBlockByNumber } from "./services/arcRpc";
import { parseTransactions } from "./services/transactionService";
import { analyzeTransactions } from "./services/analysisService";
import { generateReport } from "./reports/reportGenerator";

async function run() {
  try {
    console.log("🚀 Running ArcSense...\n");

    const latestBlock = await getBlockNumber();
    console.log("Latest Block:", latestBlock);

    const block = await getBlockByNumber(latestBlock);

    const transactions = parseTransactions(block);

    const stats = analyzeTransactions(transactions);

    const report = generateReport(stats);

    console.log(report);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
  }
}

run();