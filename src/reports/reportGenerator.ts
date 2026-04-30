export function generateReport(stats: any): string {
  return `
📊 ArcSense Report

Total Transactions: ${stats.total}
Successful: ${stats.success}
Failed: ${stats.failed}
Failure Rate: ${(stats.failureRate * 100).toFixed(2)}%

Insight:
Network looks stable.
`;
}