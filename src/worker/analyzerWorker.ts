import { JsonRpcProvider } from "ethers";
import { dequeue } from "../queue/txQueue";
import { analyzeBlock } from "../analysis/analyzer";
import { Tx } from "../types";

const RPC_URL = process.env.RPC_URL!;
const provider = new JsonRpcProvider(RPC_URL);

// tuning
const MAX_TX_PER_BLOCK = 200;
const BATCH_SIZE = 15;
const DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function startWorker() {
  console.log("🧠 Analyzer Worker started...");

  while (true) {
    const job = dequeue();

    if (!job) {
      await sleep(300);
      continue;
    }

    try {
      const txHashes = job.txHashes.slice(0, MAX_TX_PER_BLOCK);
      const receipts: Tx[] = [];

      for (let i = 0; i < txHashes.length; i += BATCH_SIZE) {
        const batch = txHashes.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map((hash) =>
            provider.getTransactionReceipt(hash)
          )
        );

        for (const res of results) {
          if (res.status === "fulfilled" && res.value) {
            receipts.push({
              hash: res.value.hash,
              from: res.value.from,
              to: res.value.to,
              value: "0",
              status: res.value.status ?? 0,
            });
          }
        }

        await sleep(DELAY_MS);
      }

      analyzeBlock(job.blockNumber, receipts);

    } catch (err: any) {
      if (err?.error?.code === 429) {
        console.log("⏳ Rate limited, backing off...");
        await sleep(2000);
      } else {
        console.log("⚠️ Worker error:", err);
      }
    }
  }
}