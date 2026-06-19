import "dotenv/config";
import * as fs   from "fs";
import * as path from "path";
import express from "express";
import cors from "cors";
import { ethers } from "ethers";
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
import {
  addPaidCredit,
} from "./payment/queryTracker";

// ── ArcSenseGate contract config ──────────────────────────────
const ARCSENSE_GATE_ADDRESS = "0xd0aEAD5b90eD18bBe830cDA38789B60F4abbab4D";

// Minimal ABI — only the events we need to listen to
const GATE_ABI = [
  "event QueryPurchased(address indexed buyer, uint8 indexed queryType, uint256 amount, bool isERC20, uint256 creditsRemaining)",
  "event FreeQueryUsed(address indexed user, uint8 indexed queryType, uint256 freeQueriesRemaining)",
];

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
// FIXED: regex only matches dated report files like
// "weekly-2026-06-12-to-2026-06-19.json"
// Previously also matched "weekly-store.json" (raw snapshot accumulator)
// which sorted first and was served instead of the real report.
app.get("/reports/weekly", (req, res) => {
  try {
    const dir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(dir)) return res.status(404).json({ error: "No weekly report yet" });

    const files = fs.readdirSync(dir)
      .filter(f => /^weekly-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.json$/.test(f))
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

// ── Contract info endpoint ────────────────────────────────────
app.get("/api/contract", (req, res) => {
  res.json({
    address:   ARCSENSE_GATE_ADDRESS,
    network:   "Arc Testnet",
    chainId:   4441,
    explorer:  `https://testnet.arcscan.app/address/${ARCSENSE_GATE_ADDRESS}`,
    functions: {
      purchaseNative: "purchaseNative(uint8 queryType) payable — send 0.1 USDC native",
      purchaseERC20:  "purchaseERC20(uint8 queryType) — approve 100000 USDC ERC-20 first",
      getCredits:     "getCredits(address) view — returns (freeRemaining, paidRemaining)",
      hasCredit:      "hasCredit(address) view — returns bool",
    },
    queryTypes: {
      0: "NETWORK",
      1: "CONTRACT_RISK",
      2: "BLOCK",
      3: "USAGE",
      4: "WEEKLY",
    },
  });
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
  console.log("🏛️  ArcSenseGate contract:", ARCSENSE_GATE_ADDRESS);
  console.log("📅 Reports API:");
  console.log("   GET  /reports");
  console.log("   GET  /reports/weekly");
  console.log("🧠 Intelligence API:");
  console.log("   GET  /api/intelligence/contract/:address");
  console.log("   GET  /api/intelligence/network");
  console.log("   GET  /api/intelligence/block/:number");
  console.log("   POST /api/intelligence/confirm/:queryId");
  console.log("   GET  /api/intelligence/usage");
  console.log("   GET  /api/contract");
  console.log("⚡ Agent API:");
  console.log("   GET  /agent/status");
  console.log("   GET  /agent/log");
  console.log("   POST /agent/run");
});

// ── ArcSenseGate event listener ───────────────────────────────
// Listens for QueryPurchased events on the contract and
// automatically credits the buyer's wallet without manual confirmation.
async function startContractEventListener() {
  try {
    const { provider } = await import("./utils/provider");
    const gate = new ethers.Contract(ARCSENSE_GATE_ADDRESS, GATE_ABI, provider);

    console.log(`🏛️  Listening for ArcSenseGate events...`);
    console.log(`   Contract: ${ARCSENSE_GATE_ADDRESS}`);

    // QueryPurchased — paid query via contract
    gate.on("QueryPurchased", (buyer: string, queryType: number, amount: bigint, isERC20: boolean, creditsRemaining: bigint) => {
      const queryTypes = ["NETWORK", "CONTRACT_RISK", "BLOCK", "USAGE", "WEEKLY"];
      const typeName   = queryTypes[queryType] || `UNKNOWN(${queryType})`;
      const amountUSDC = isERC20
        ? Number(amount) / 1e6    // ERC-20: 6 decimals
        : Number(amount) / 1e18;  // Native: 18 decimals

      console.log(`\n🏛️  QueryPurchased event detected`);
      console.log(`   Buyer:      ${buyer}`);
      console.log(`   QueryType:  ${typeName}`);
      console.log(`   Amount:     ${amountUSDC.toFixed(4)} USDC`);
      console.log(`   Path:       ${isERC20 ? "ERC-20" : "Native USDC"}`);
      console.log(`   Credits:    ${creditsRemaining} remaining after purchase`);

      // Credit the buyer's wallet automatically
      addPaidCredit(buyer);
      console.log(`   ✅ Credit added for ${buyer.slice(0, 8)}...`);
    });

    // FreeQueryUsed — track free query usage from contract
    gate.on("FreeQueryUsed", (user: string, queryType: number, freeQueriesRemaining: bigint) => {
      const queryTypes = ["NETWORK", "CONTRACT_RISK", "BLOCK", "USAGE", "WEEKLY"];
      const typeName   = queryTypes[queryType] || `UNKNOWN(${queryType})`;

      console.log(`\n🏛️  FreeQueryUsed event detected`);
      console.log(`   User:       ${user}`);
      console.log(`   QueryType:  ${typeName}`);
      console.log(`   Free left:  ${freeQueriesRemaining}`);
    });

    console.log(`✅ Contract event listener active`);
  } catch (err: any) {
    console.error("❌ Failed to start contract event listener:", err.message);
    console.log("⚠️  Continuing without contract events — manual /confirm still works");
  }
}

// ── Engine ────────────────────────────────────────────────────
async function start() {
  console.log("🚀 Signal Engine started...");
  console.log(`🏛️  ArcSenseGate: ${ARCSENSE_GATE_ADDRESS}`);

  let currentBlock = await getLatestBlock();

  // Start contract event listener
  await startContractEventListener();

  // Start agent after 10s warmup
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