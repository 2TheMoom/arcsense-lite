export type Severity = "LOW" | "MEDIUM" | "HIGH";

export function getSeverity(failureRate: number): Severity {
  if (failureRate > 0.15) return "HIGH";
  if (failureRate > 0.05) return "MEDIUM";
  return "LOW";
}

export function generateAlerts(report: any, trend: string): string[] {
  const alerts: string[] = [];

  if (report.failureRate > 0.1) {
    alerts.push("🚨 High failure rate detected");
  } else if (report.failureRate > 0.05) {
    alerts.push("⚠️ Elevated failure rate");
  }

  if (trend.includes("rising")) {
    alerts.push("📈 Failure trend increasing");
  }

  return alerts;
}