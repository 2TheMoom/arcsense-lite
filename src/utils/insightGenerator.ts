import { AnalysisReport } from "../analysis/analyzer";

export function generateInsight(
  report: AnalysisReport,
  trend: string,
  contractMemory: Record<string, number>
): string {
  if (report.failed === 0) {
    if (trend === "Stable behavior") {
      return "Sustained clean execution across recent blocks. No anomaly patterns detected.";
    }
    return "No failures detected. Network execution is clean.";
  }

  if (report.failureRate > 0.15) {
    return "Elevated failure rate detected across multiple transactions.";
  }

  if (report.failureRate > 0.05) {
    return "Irregular failure pattern detected. Monitoring closely.";
  }

  if (report.topFailingContracts.length > 0) {
    const [addr] = report.topFailingContracts[0];
    return `Single failure observed from ${addr}. Early signal only.`;
  }

  return "Network mostly clean with occasional minor failures.";
}