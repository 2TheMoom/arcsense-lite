import { BlockReport } from "../types";

let latest: BlockReport | null = null;

export function pushBlockReport(report: BlockReport) {
  latest = report;
  printSignal(report);
}

export function startSignalEngine() {
  console.log("🚀 Signal Engine started...");
}

function printSignal(r: BlockReport) {
  console.log("\n📊 ===== ArcSense Signals =====\n");

  const sorted = Object.entries(r.contractStats)
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 5);

  for (const [addr, stats] of sorted) {
    const rate = stats.calls === 0 ? 0 : stats.fail / stats.calls;

    console.log(`📍 Contract: ${addr}`);
    console.log(`   Calls: ${stats.calls}`);
    console.log(`   Success: ${stats.success}`);
    console.log(`   Fail: ${stats.fail}`);
    console.log(`   Failure Rate: ${(rate * 100).toFixed(2)}%`);
    console.log(`   Severity: ${buildSeverity(rate)}\n`);
  }

  console.log("================================\n");

  console.log(`🔥 Trend: ${buildTrend(r.failureRate)}`);
  console.log(`💡 Insight: ${buildInsight(r.failureRate)}`);
  console.log(`🚨 Severity: ${buildSeverity(r.failureRate)}`);
}

function buildSeverity(rate: number): string {
  if (rate > 0.4) return "🔴 CRITICAL";
  if (rate > 0.2) return "🟠 HIGH";
  if (rate > 0.1) return "🟡 ELEVATED";
  return "🟢 NORMAL";
}

function buildTrend(rate: number): string {
  if (rate > 0.3) return "Failure rate accelerating sharply";
  if (rate > 0.1) return "Failure rate gradually increasing";
  return "Failure rate stable";
}

function buildInsight(rate: number): string {
  if (rate > 0.3)
    return "Significant failure concentration detected across multiple contracts";
  if (rate > 0.1)
    return "Moderate failure activity emerging in recent transactions";
  return "Network operating within normal parameters";
}