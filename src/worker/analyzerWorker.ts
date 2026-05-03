import { JsonRpcProvider } from "ethers";
import { dequeue } from "../queue/txQueue";
import { analyzeBlock } from "../analysis/analyzeBlock";

export class AnalyzerWorker {
  private provider: JsonRpcProvider;

  constructor(rpcUrl: string) {
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  start() {
    console.log("🧠 Analyzer Worker started...");

    setInterval(async () => {
      const job = dequeue();
      if (!job) return;

      const txHashes = job.txHashes;
      const total = txHashes.length;

      // 🔥 Dynamic Sampling Logic
      let sampleSize: number;

      if (total <= 100) sampleSize = total;
      else if (total <= 300) sampleSize = Math.floor(total * 0.6);
      else if (total <= 800) sampleSize = Math.floor(total * 0.4);
      else sampleSize = 200;

      const sampled = txHashes.slice(0, sampleSize);

      const receipts = [];

      for (const hash of sampled) {
        try {
          const receipt = await this.provider.getTransactionReceipt(hash);
          if (receipt) receipts.push(receipt);
        } catch {
          // ignore RPC errors silently
        }
      }

      analyzeBlock(job.blockNumber, receipts);
    }, 1000);
  }
}