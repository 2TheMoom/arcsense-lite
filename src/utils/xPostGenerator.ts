export function generateXPost(report: any): string {
  const total = report.total || 0;
  const failed = report.failed || 0;

  const percent = total === 0
    ? "0.00"
    : ((failed / total) * 100).toFixed(2);

  const [topContract, topCount] =
    report.topFailingContracts?.[0] || ["N/A", 0];

  const dominance =
    failed === 0 ? 0 : Math.round((topCount / failed) * 100);

  return `🐦 ArcSense Signal

${percent}% failure rate (${failed}/${total} tx)

Failure rate is climbing.

But here’s the signal:

${
  failed > 0
    ? `${dominance}% of failures come from ONE contract:
${topContract}`
    : `No failing contracts detected.`
}

That’s not random — it points to a contract-level issue.

Not critical yet.
But this is how breakpoints form.

Track failures.
Ignore noise.

#Arc #Testnet #OnchainData`;
}