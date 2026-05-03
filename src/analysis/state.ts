type ContractStats = {
  totalTx: number;
  failedTx: number;
};

const contractState: Record<string, ContractStats> = {};
let lastFailureRate: number | null = null;

export function updateContractStats(to: string | null, success: boolean) {
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
      totalFailures: stats.failedTx,
      totalTx: stats.totalTx,
      failureRate: stats.totalTx === 0 ? 0 : stats.failedTx / stats.totalTx,
    }))
    .sort((a, b) => b.totalFailures - a.totalFailures) // 🔥 better than rate for signal
    .slice(0, limit);
}

export function computeTrend(currentRate: number): string {
  if (lastFailureRate === null) {
    lastFailureRate = currentRate;
    return "Stable";
  }

  let trend = "Stable";

  if (currentRate > lastFailureRate) {
    trend = "Increasing failures detected";
  } else if (currentRate < lastFailureRate) {
    trend = "Decreasing failures";
  }

  lastFailureRate = currentRate;
  return trend;
}