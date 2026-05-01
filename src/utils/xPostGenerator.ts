export function generateXPost(
  report: any,
  trend: string,
  insight: string
): string {
  const rate = (report.failureRate * 100).toFixed(2);

  let tone = "";

  if (report.failureRate === 0) {
    tone = "Network is clean. No execution friction detected.";
  } else if (report.failureRate < 0.08) {
    tone = "System looks stable on the surface.";
  } else {
    tone = "Failure rate is elevated.";
  }

  let contractLine = "";
  if (report.topFailingContracts.length > 0) {
    const [contract, count] = report.topFailingContracts[0];

    if (count >= 2) {
      contractLine = `\nRepeated failures from:\n${contract}`;
    } else {
      contractLine = `\nSingle-point failure detected:\n${contract}`;
    }
  }

  return `
🐦 ArcSense Signal

${rate}% failure rate (${report.failed}/${report.total} tx)

${tone}

But here’s the signal:

${trend}
${contractLine}

${insight}

Tracking failures > tracking activity.

#Arc #Testnet #OnchainData
`;
}