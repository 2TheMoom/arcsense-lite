import "dotenv/config";
import { WebSocketProvider } from "ethers";
import { RealtimeMonitor } from "./realtime/monitor";
import { startWorker } from "./worker/analyzerWorker";

console.log("⚡ Booting ArcSense...");

const WS_URL = process.env.WS_URL;

if (!WS_URL) {
  throw new Error("Missing WS_URL in .env");
}

const wsProvider = new WebSocketProvider(WS_URL);

// ✅ start monitor
const monitor = new RealtimeMonitor(wsProvider);
monitor.start();

// ✅ start worker (NO CLASS)
startWorker();