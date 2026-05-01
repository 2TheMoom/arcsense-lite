export function generateThread(
  report: any,
  trend: string,
  insight: string
): string | null {
  if (report.failed === 0) return null;

  const rate = (report.failureRate * 100).toFixed(2);

  let contractPart = "";

  if (report.topFailingContracts.length > 0) {
    const [contract, count] = report.topFailingContracts[0];

    contractPart =
      count >= 2
        ? `Failures are clustering around ${contract}.`
        : `Failure observed at ${contract}.`;
  }

  return `
1/ ${rate}% of transactions failed in this block.

2/ ${trend} — not random movement.

3/ ${contractPart}

4/ ${insight}

5/ Early signals like this often precede larger breakdowns.

6/ Watching closely.
`;
}