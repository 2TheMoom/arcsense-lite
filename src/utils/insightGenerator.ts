export function generateInsights(report: any, trend: string): string {
  if (report.failureRate === 0) {
    return "Network looks stable.";
  }

  if (report.topFailingContracts.length === 0) {
    return "No major issues detected.";
  }

  const [top] = report.topFailingContracts;

  return `Top failing contract: ${top[0]} with ${top[1]} failures.`;
}