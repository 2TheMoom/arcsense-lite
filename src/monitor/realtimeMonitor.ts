import { Provider } from "ethers";
import { enqueueJob } from "../queue/txQueue";

export function startRealtimeMonitor(provider: Provider) {
  console.log("⚡ Realtime Monitor started...");

  provider.on("block", async (blockNumber: number) => {
    const block = await provider.getBlock(blockNumber);

    if (!block) return;

    enqueueJob({
      blockNumber,
      txHashes: [...block.transactions], // FIX readonly issue
    });
  });
}