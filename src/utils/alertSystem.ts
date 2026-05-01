export function generateAlerts(report: any, trend: string): string[] {
  const alerts: string[] = [];

  if (report.failureRate > 0.05) {
    alerts.push(`⚠️ Elevated failure rate: ${(report.failureRate * 100).toFixed(2)}%`);
  }

  if (report.topFailingContracts.length > 0) {
    const [addr, count] = report.topFailingContracts[0];
    const dominance = count / (report.failed || 1);

    if (dominance > 0.8) {
      alerts.push(`⚠️ Contract dominating failures: ${addr}`);
    }
  }

  return alerts;
}