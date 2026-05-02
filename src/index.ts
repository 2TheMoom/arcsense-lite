import { startMonitor } from "./realtime/monitor";
import { JsonRpcProvider } from "ethers";
import { RPC_URL } from "./config/env";

async function main() {
  console.log("BOOTING...");

  if (!RPC_URL) {
    throw new Error("❌ RPC_URL is missing in .env");
  }

  // create provider
  const provider = new JsonRpcProvider(RPC_URL);

  console.log("⚡ Starting ArcSense Realtime Monitor...\n");

  // ✅ matches your updated monitor signature
  await startMonitor(provider);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});