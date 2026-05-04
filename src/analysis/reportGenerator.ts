import { BlockReport } from "./analyzeBlock";

export function pushBlockReport(report: BlockReport) {
  console.log("\n📊 Block Report");
  console.log("Block:", report.blockNumber);
  console.log("Total TX:", report.totalTx);
  console.log("Failed TX:", report.failedTx);
  console.log("Failure Rate:", report.failureRate.toFixed(2));
  console.log("Severity:", report.severity);
}