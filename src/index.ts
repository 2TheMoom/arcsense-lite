import "dotenv/config";
import { JsonRpcProvider } from "ethers";
import { startMonitor } from "./realtime/monitor";

async function main() {
  console.log("BOOTING...");

  // ✅ support both names (flexible)
  const rpcUrl =
    process.env.RPC_URL || process.env.ALCHEMY_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing RPC_URL or ALCHEMY_RPC_URL in .env");
  }

  const provider = new JsonRpcProvider(rpcUrl);

  await startMonitor(provider);
}

main();