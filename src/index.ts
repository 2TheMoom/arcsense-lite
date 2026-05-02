import { ethers } from "ethers";
import { startMonitor } from "./realtime/monitor";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("BOOTING...");
  console.log("⚡ Starting ArcSense Realtime Monitor...\n");

  const RPC_URL = process.env.RPC_URL;

  if (!RPC_URL) {
    console.error("❌ RPC_URL is missing in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  await startMonitor(provider);
}

main().catch(console.error);