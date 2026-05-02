export function generateThread(
  report: any,
  trend: string,
  insight: string,
  severity: string
): string {
  const percent = (report.failureRate * 100).toFixed(2);

  return `1/ ${percent}% of transactions failed in this block.

2/ ${trend} — not random movement.

3/ Severity: ${severity}

4/ ${insight}

5/ Early signals like this often precede larger breakdowns.

6/ Watching closely.`;
}