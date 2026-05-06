let failureRates: number[] = [];
let contractFailures: Record<string, number> = {};

export function updateFailureRate(rate: number) {
  failureRates.push(rate);

  if (failureRates.length > 20) {
    failureRates.shift();
  }
}

export function getTrend(): string {
  if (failureRates.length < 5) return "Insufficient data";

  const recent = failureRates.slice(-5);
  const avgRecent =
    recent.reduce((a, b) => a + b, 0) / recent.length;

  const past = failureRates.slice(0, -5);
  const avgPast =
    past.reduce((a, b) => a + b, 0) / (past.length || 1);

  if (avgRecent > avgPast * 1.2)
    return "Failure rate rising";

  if (avgRecent < avgPast * 0.8)
    return "Failure rate dropping";

  return "Stable activity";
}

export function trackContractFailure(address: string) {
  if (!address) address = "unknown";

  contractFailures[address] =
    (contractFailures[address] || 0) + 1;
}

export function getContractHistory() {
  return contractFailures;
}