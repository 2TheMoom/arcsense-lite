import "dotenv/config";
import { startMonitor } from "./realtime/monitor";
import { JsonRpcProvider } from "ethers";

async function main() {
  console.log("BOOTING...\n");

  const provider = new JsonRpcProvider(process.env.RPC_URL);

  await startMonitor(provider);
}

main();