import "dotenv/config";
import express from "express";
import cors from "cors";
import { analyzeBlock } from "./analysis/analyzeBlock";
import { pushBlockReport } from "./analysis/reportGenerator";

// ── API server ────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: ["https://arcsense-lite.vercel.app", "http://localhost:5173"],
}));

let latestReports: any[]    = [];
let totalBlocksScanned      = 0;
let totalAlertsTriggered    = 0;

app.get("/reports", (req, res) => {
  res.json({
    meta: {
      totalBlocksScanned,
      totalAlertsTriggered,
    },
    reports: latestReports.slice(-200),
  });
});

app.listen(3001, () => {
  console.log("📡 API running on http://localhost:3001");
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