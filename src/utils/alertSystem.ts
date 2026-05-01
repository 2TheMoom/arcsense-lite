export function generateAlerts(report: any, trend: string): string[] {
  const alerts: string[] = [];

  if (report.failureRate >= 0.15) {
    alerts.push("🚨 High failure rate — potential system stress");
  } else if (report.failureRate >= 0.08) {
    alerts.push("⚠️ Elevated failure rate");
  }

  if (report.topFailingContracts?.length > 0) {
    const [contract, count] = report.topFailingContracts[0];

    if (count >= 2) {
      alerts.push(`📍 Concentrated failures at ${contract}`);
    }
  }

  return alerts;
}