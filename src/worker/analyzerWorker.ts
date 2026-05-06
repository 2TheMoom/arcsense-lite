import { analyzeBlock, BlockReport } from "../analysis/analyzeBlock";
import { pushBlockReport } from "../analysis/reportGenerator";
import { provider } from "../utils/provider";

export async function startAnalyzerWorker() {
  console.log("🧠 Analyzer Worker started...");

  provider.on("block", async (blockNumber: number) => {
    try {
      const report: BlockReport | null = await analyzeBlock(blockNumber);

      if (!report) return;

      pushBlockReport(report);
    } catch (err) {
      console.error("Worker error:", err);
    }
  });
}