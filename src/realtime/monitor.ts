import { JsonRpcProvider } from "ethers";
import { analyzeTransactions } from "../analysis/analyzer";
import { generateInsight } from "../utils/insightGenerator";
import { triggerSmartAlerts } from "../utils/alertSystem";

export async function startMonitor(provider: JsonRpcProvider) {
  console.log("⚡ Starting ArcSense Realtime Monitor...\n");

  provider.on("block", async (blockNumber: number) => {
    try {
      const block = await provider.getBlock(blockNumber);

      if (!block || !block.transactions) return;

      console.log(`🆕 Block ${blockNumber} → ${block.transactions.length} tx`);

      // ✅ Fix readonly array issue
      const txHashes = [...block.transactions];

      // ✅ Sampling (performance control)
      const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE) || 350;
      const batch = txHashes.slice(0, SAMPLE_SIZE);

      // ✅ FIX: pass fetch function instead of provider
      const report = await analyzeTransactions(
        batch,
        async (hash: string) => {
          return await provider.getTransaction(hash);
        }
      );

      console.log("\n📊 Report:", report);

      // ✅ Correct usage (single argument)
      const insight = generateInsight(report);

      console.log("📈 Trend:", insight.trend);
      console.log("🧠 Insight:", insight.message);
      console.log("🔥 Severity:", insight.severity);

      // ✅ Smart Alerts
      const alerts = triggerSmartAlerts(report);

      console.log("🚨 Alerts:");
      if (alerts.length === 0) {
        console.log("None\n");
      } else {
        alerts.forEach((alert, i) => {
          console.log(`${i + 1}. ${alert}`);
        });
        console.log();
      }

    } catch (error) {
      console.error("❌ Monitor error:", error);
    }
  });
}