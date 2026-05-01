export function generateReport(data: any): string {
  const total = data.totalTransactions ?? 0;
  const failed = data.totalFailed ?? 0;
  const success = total - failed;
  const failureRate = data.avgFailureRate ?? 0;

  let report = `
📊 ArcSense Report

Total Transactions: ${total}
Successful: ${success}
Failed: ${failed}
Failure Rate: ${(failureRate * 100).toFixed(2)}%
`;

  if (!data.topFailingContracts || data.topFailingContracts.length === 0) {
    report += `\nNo failing contracts detected.\n`;
  } else {
    report += `\nTop Failing Contracts:\n`;
    data.topFailingContracts.forEach(
      ([address, count]: [string, number]) => {
        report += `- ${address} → ${count} failures\n`;
      }
    );
  }

  return report;
}