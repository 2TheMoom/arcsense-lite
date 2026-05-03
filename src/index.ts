import "dotenv/config";
import { WebSocketProvider } from "ethers";
import { RealtimeMonitor } from "./realtime/monitor";
import { AnalyzerWorker } from "./worker/analyzerWorker";

console.log("⚡ Booting ArcSense...");

const WS_URL = process.env.WS_URL;
const RPC_URL = process.env.RPC_URL;

if (!WS_URL || !RPC_URL) {
  throw new Error("Missing WS_URL or RPC_URL in .env");
}

// 🌐 Realtime Monitor
const wsProvider = new WebSocketProvider(WS_URL);
const monitor = new RealtimeMonitor(wsProvider);
monitor.start();

// 🧠 Worker
const worker = new AnalyzerWorker(RPC_URL);
worker.start();