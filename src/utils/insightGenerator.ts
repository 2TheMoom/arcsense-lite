export function generateInsight(report: any, trend: string): string {
  if (report.failed === 0) {
    return "No failures detected. Network execution is clean.";
  }

  const top = report.topFailingContracts?.[0];

  if (!top) {
    return "Failures detected but attribution is unclear — likely scattered noise.";
  }

  const [contract, count] = top;

  if (count >= 2 && report.failed >= 2) {
    return `Repeated failures from ${contract}. This is no longer random — contract-level instability forming.`;
  }

  if (report.failed === 1) {
    return `Single failure observed from ${contract}. Early signal — not statistically strong yet.`;
  }

  return "Failure activity detected, but no dominant pattern yet.";
}