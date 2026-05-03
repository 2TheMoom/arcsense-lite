import { WebSocketProvider } from "ethers";
import { enqueue } from "../queue/txQueue";

export class RealtimeMonitor {
  private provider: WebSocketProvider;

  constructor(provider: WebSocketProvider) {
    this.provider = provider;
  }

  start() {
    console.log("⚡ Realtime Monitor started...");

    this.provider.on("block", async (blockNumber: number) => {
      try {
        const block = await this.provider.getBlock(blockNumber);

        if (!block || !block.transactions) return;

        const txHashes = [...block.transactions]; // ✅ fix readonly issue

        console.log(
          `📥 Queued Block ${blockNumber} | Tx count: ${txHashes.length}`
        );

        // ✅ push into queue (NEW SYSTEM)
        enqueue({
          blockNumber,
          txHashes,
        });

      } catch (err: any) {
        if (err?.error?.code === 429) {
          console.log("⏳ Rate limited (monitor), retrying...");
        } else {
          console.log("⚠️ Monitor error:", err);
        }
      }
    });
  }
}