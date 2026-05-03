type AnalysisReport = {
  total: number;
  successful: number;
  failed: number;
  failureRate: number;
  topFailingContracts: [string, number][];
  contractHistory: Record<string, number>;
};

let contractMemory: Record<string, number> = {};

export function triggerSmartAlerts(report: AnalysisReport): string[] {
  const alerts: string[] = [];

  // Rule 1: High failure rate
  if (report.failureRate > 0.1) {
    alerts.push("⚠️ High failure rate detected (>10%)");
  }

  // Rule 2: Repeating contracts across blocks
  for (const [contract, count] of report.topFailingContracts) {
    contractMemory[contract] = (contractMemory[contract] || 0) + count;

    if (contractMemory[contract] >= 3) {
      alerts.push(`🔁 Repeated failures from ${contract}`);
    }
  }

  return alerts;
}