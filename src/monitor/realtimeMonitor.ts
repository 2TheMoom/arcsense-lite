import { provider } from "../utils/provider";

export async function startRealtimeMonitor() {
  console.log("📡 Realtime Monitor started...");

  provider.on("block", (blockNumber: number) => {
    console.log("📦 New block:", blockNumber);
  });
}