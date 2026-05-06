import "dotenv/config";
import express from "express";
import cors from "cors";
import { analyzeBlock } from "./analysis/analyzeBlock";
import { pushBlockReport } from "./analysis/reportGenerator";

// ── API server ────────────────────────────────────────────────
const app = express();
app.use(cors());

let latestReports: any[] = [];

app.get("/reports", (req, res) => {
  res.json(latestReports.slice(-50));
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

        // feed the API
        latestReports.push(report);
        if (latestReports.length > 200) latestReports.shift();
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