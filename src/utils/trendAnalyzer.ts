export function analyzeTrend(report: any): string {
  if (report.failureRate === 0) return "Failure rate unchanged (0.00%)";
  if (report.failureRate < 0.05) return "Failure rate is low";
  if (report.failureRate < 0.1) return "Failure rate is moderate";
  return "Failure rate is high";
}