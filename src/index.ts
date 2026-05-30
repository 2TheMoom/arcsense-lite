import "dotenv/config";
import * as fs   from "fs";
import * as path from "path";
import express from "express";
import cors from "cors";
import { analyzeBlock } from "./analysis/analyzeBlock";
import { pushBlockReport } from "./analysis/reportGenerator";
import {
  queryContractIntelligence,
  queryNetworkHealth,
  queryBlockAnalysis,
  confirmPayment,
  getUsageStats,
  updateSharedBlocks,
} from "./api/intelligenceApi";
import {
  startAgentScheduler,
  stopAgentScheduler,
  runAgentCycle,
  getAgentStatus,
  getAgentLog,
  getAgentFullLog,
} from "./agent/arcAgent";

// ── API server ────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://arcsense-lite.vercel.app", "http://localhost:5173"],
}));

let latestReports: any[] = [];
let totalBlocksScanned   = 0;
let totalAlertsTriggered = 0;

// ── Reports endpoint ──────────────────────────────────────────
app.get("/reports", (req, res) => {
  res.json({
    meta: { totalBlocksScanned, totalAlertsTriggered },
    reports: latestReports.slice(-200),
  });
});

// ── Weekly report endpoint ────────────────────────────────────
app.get("/reports/weekly", (req, res) => {
  try {
    const dir   = path.join(process.cwd(), "reports");
    if (!fs.existsSync(dir)) return res.status(404).json({ error: "No weekly report yet" });
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith("weekly-") && f.endsWith(".json"))
      .sort()
      .reverse();
    if (files.length === 0) return res.status(404).json({ error: "No weekly report yet" });
    const latest = JSON.parse(fs.readFileSync(path.join(dir, files[0]), "utf-8"));
    res.json(latest);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load weekly report" });
  }
});

// ── Intelligence API routes ───────────────────────────────────
app.get("/api/intelligence/contract/:address", async (req, res) => {
  const { address } = req.params;
  const wallet = req.query.wallet as string;
  const mode   = (req.query.mode as "prepay" | "postpay") || "prepay";
  if (!wallet) return res.status(400).json({ error: "wallet address required" });
  const result = await queryContractIntelligence(address, wallet, mode);
  res.json(result);
});

app.get("/api/intelligence/network", async (req, res) => {
  const wallet = req.query.wallet as string;
  const mode   = (req.query.mode as "prepay" | "postpay") || "prepay";
  if (!wallet) return res.status(400).json({ error: "wallet address required" });
  const result = await queryNetworkHealth(wallet, mode);
  res.json(result);
});

app.get("/api/intelligence/block/:number", async (req, res) => {
  const blockNumber = parseInt(req.params.number);
  const wallet      = req.query.wallet as string;
  const mode        = (req.query.mode as "prepay" | "postpay") || "prepay";
  if (isNaN(blockNumber)) return res.status(400).json({ error: "invalid block number" });
  if (!wallet) return res.status(400).json({ error: "wallet address required" });
  const result = await queryBlockAnalysis(blockNumber, wallet, mode);
  res.json(result);
});

app.post("/api/intelligence/confirm/:queryId", async (req, res) => {
  const { queryId }      = req.params;
  const { txId, wallet } = req.body;
  if (!txId || !wallet) return res.status(400).json({ error: "txId and wallet required" });
  const result = await confirmPayment(queryId, txId, wallet);
  res.json(result);
});

app.get("/api/intelligence/usage", async (req, res) => {
  const wallet = req.query.wallet as string;
  if (!wallet) return res.status(400).json({ error: "wallet address required" });
  const result = await getUsageStats(wallet);
  res.json(result);
});

// ── Agent routes ──────────────────────────────────────────────

app.get("/agent/status", (req, res) => {
  res.json(getAgentStatus());
});

app.get("/agent/log", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json({ decisions: getAgentLog(limit) });
});

app.get("/agent/log/full", (req, res) => {
  res.json(getAgentFullLog());
});

app.post("/agent/run", async (req, res) => {
  try {
    console.log("🔧 Manual agent trigger received");
    const result = await runAgentCycle();
    res.json({
      success:     true,
      cycleNumber: result.cycleNumber,
      decision:    result.decision,
      balance:     result.balance,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/agent/stop", (req, res) => {
  stopAgentScheduler();
  res.json({ success: true, message: "Agent scheduler stopped" });
});

app.post("/agent/start", (req, res) => {
  startAgentScheduler();
  res.json({ success: true, message: "Agent scheduler started" });
});

app.listen(3001, () => {
  console.log("📡 API running on http://localhost:3001");
  console.log("🧠 Intelligence API:");
  console.log("   GET  /api/intelligence/contract/:address");
  console.log("   GET  /api/intelligence/network");
  console.log("   GET  /api/intelligence/block/:number");
  console.log("   POST /api/intelligence/confirm/:queryId");
  console.log("   GET  /api/intelligence/usage");
  console.log("📅 Reports API:");
  console.log("   GET  /reports");
  console.log("   GET  /reports/weekly");
  console.log("⚡ Agent API:");
  console.log("   GET  /agent/status");
  console.log("   GET  /agent/log");
  console.log("   POST /agent/run");
  console.log("   POST /agent/stop");
  console.log("   POST /agent/start");
});

// ── Engine ────────────────────────────────────────────────────
async function start() {
  console.log("🚀 Signal Engine started...");

  let currentBlock = await getLatestBlock();

  setTimeout(() => {
    startAgentScheduler();
  }, 10000);

  while (true) {
    try {
      const report = await analyzeBlock(currentBlock);

      if (report) {
        pushBlockReport(report);
        latestReports.push(report);
        if (latestReports.length > 500) latestReports.shift();
        updateSharedBlocks(latestReports);
        totalBlocksScanned++;
        if (report.failureRate >= 0.10) totalAlertsTriggered++;
      }

      currentBlock++;
      await sleep(1500);
    } catch (err) {
      console.log("Main loop error:", err);
      await sleep(3000);
    }
  }
}

async function getLatestBlock() {
  const { provider } = await import("./utils/provider");
  return await provider.getBlockNumber();
}

const sleep = (ms: number) =>
  new Promise((res) => setTimeout(res, ms));

start();