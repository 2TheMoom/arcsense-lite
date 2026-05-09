import "dotenv/config";
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

// ── API server ────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://arcsense-lite.vercel.app", "http://localhost:5173"],
}));

let latestReports: any[]    = [];
let totalBlocksScanned      = 0;
let totalAlertsTriggered    = 0;

// ── Existing reports endpoint ─────────────────────────────────
app.get("/reports", (req, res) => {
  res.json({
    meta: {
      totalBlocksScanned,
      totalAlertsTriggered,
    },
    reports: latestReports.slice(-200),
  });
});

// ── Intelligence API routes ───────────────────────────────────

// Contract risk score
// GET /api/intelligence/contract/0xABC...?wallet=0xYOUR...&mode=prepay
app.get("/api/intelligence/contract/:address", async (req, res) => {
  const { address } = req.params;
  const wallet = req.query.wallet as string;
  const mode   = (req.query.mode as "prepay" | "postpay") || "prepay";

  if (!wallet) {
    return res.status(400).json({ error: "wallet address required. Add ?wallet=0xYourAddress" });
  }

  const result = await queryContractIntelligence(address, wallet, mode);
  res.json(result);
});

// Network health snapshot
// GET /api/intelligence/network?wallet=0xYOUR...&mode=prepay
app.get("/api/intelligence/network", async (req, res) => {
  const wallet = req.query.wallet as string;
  const mode   = (req.query.mode as "prepay" | "postpay") || "prepay";

  if (!wallet) {
    return res.status(400).json({ error: "wallet address required. Add ?wallet=0xYourAddress" });
  }

  const result = await queryNetworkHealth(wallet, mode);
  res.json(result);
});

// Block analysis
// GET /api/intelligence/block/12345678?wallet=0xYOUR...&mode=prepay
app.get("/api/intelligence/block/:number", async (req, res) => {
  const blockNumber = parseInt(req.params.number);
  const wallet      = req.query.wallet as string;
  const mode        = (req.query.mode as "prepay" | "postpay") || "prepay";

  if (isNaN(blockNumber)) {
    return res.status(400).json({ error: "invalid block number" });
  }

  if (!wallet) {
    return res.status(400).json({ error: "wallet address required. Add ?wallet=0xYourAddress" });
  }

  const result = await queryBlockAnalysis(blockNumber, wallet, mode);
  res.json(result);
});

// Confirm payment after prepay
// POST /api/intelligence/confirm/:queryId  { txId, wallet }
app.post("/api/intelligence/confirm/:queryId", async (req, res) => {
  const { queryId } = req.params;
  const { txId, wallet } = req.body;

  if (!txId || !wallet) {
    return res.status(400).json({ error: "txId and wallet are required in request body" });
  }

  const result = await confirmPayment(queryId, txId, wallet);
  res.json(result);
});

// Usage stats for a wallet
// GET /api/intelligence/usage?wallet=0xYOUR...
app.get("/api/intelligence/usage", async (req, res) => {
  const wallet = req.query.wallet as string;

  if (!wallet) {
    return res.status(400).json({ error: "wallet address required. Add ?wallet=0xYourAddress" });
  }

  const result = await getUsageStats(wallet);
  res.json(result);
});

app.listen(3001, () => {
  console.log("📡 API running on http://localhost:3001");
  console.log("🧠 Intelligence API ready:");
  console.log("   GET  /api/intelligence/contract/:address");
  console.log("   GET  /api/intelligence/network");
  console.log("   GET  /api/intelligence/block/:number");
  console.log("   POST /api/intelligence/confirm/:queryId");
  console.log("   GET  /api/intelligence/usage");
});

// ── Engine ────────────────────────────────────────────────────
async function start() {
  console.log("🚀 Signal Engine started...");

  let currentBlock = await getLatestBlock();

  while (true) {
    try {
      const report = await analyzeBlock(currentBlock);

      if (report) {
        pushBlockReport(report);

        // Feed the API
        latestReports.push(report);
        if (latestReports.length > 500) latestReports.shift();

        // Keep intelligence API in sync
        updateSharedBlocks(latestReports);

        // Persistent counters — never reset
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