export function generateReport(stats: any): string {
  let contractSection = "";

  if (stats.topFailingContracts && stats.topFailingContracts.length > 0) {
    contractSection = "\nTop Failing Contracts:\n";

    stats.topFailingContracts.forEach(
      ([address, count]: [string, number]) => {
        contractSection += `- ${address} → ${count} failures\n`;
      }
    );
  } else {
    contractSection = "\nNo failing contracts detected.\n";
  }

  return `
📊 ArcSense Report

Total Transactions: ${stats.total}
Successful: ${stats.success}
Failed: ${stats.failed}
Failure Rate: ${(stats.failureRate * 100).toFixed(2)}%

Insight:
${stats.failureRate > 0.1
  ? "High failure rate detected. Investigate contracts."
  : "Network looks stable."}

${contractSection}
`;
}