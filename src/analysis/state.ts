type ContractStats = {
  totalTx: number;
  failedTx: number;
};

const contractState: Record<string, ContractStats> = {};
let lastFailureRate: number | null = null;

export function updateContractStats(to: string, success: boolean) {
  if (!to) return;

  if (!contractState[to]) {
    contractState[to] = { totalTx: 0, failedTx: 0 };
  }

  contractState[to].totalTx += 1;
  if (!success) {
    contractState[to].failedTx += 1;
  }
}

export function getTopContracts(limit = 3) {
  return Object.entries(contractState)
    .map(([address, stats]) => ({
      address,
      failureRate: stats.failedTx / stats.totalTx,
      totalTx: stats.totalTx,
    }))
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, limit);
}

export function computeTrend(currentRate: number): string {
  if (lastFailureRate === null) {
    lastFailureRate = currentRate;
    return "N/A";
  }

  const trend =
    currentRate > lastFailureRate
      ? "⬆ Rising"
      : currentRate < lastFailureRate
      ? "⬇ Falling"
      : "→ Stable";

  lastFailureRate = currentRate;
  return trend;
}