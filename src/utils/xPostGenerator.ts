export function generateXPost(report: any) {
  const failureRate = (report.avgFailureRate * 100).toFixed(2);
  const totalFailed = report.totalFailed;

  if (totalFailed === 0) {
    return `🐦 ArcSense Update

Testnet activity remains stable.

0 failed transactions across the last ${report.blocksAnalyzed} blocks.

Tracking real testnet behavior > farming noise.

#Arc #Testnet #Web3`;
  }

  const [topAddr, topCount] = report.topFailingContracts[0];
  const dominance = topCount / totalFailed;
  const dominancePct = Math.round(dominance * 100);

  let insightLine = "";

  if (dominance >= 0.8) {
    insightLine = `One contract is responsible for ${dominancePct}% of failures:
${topAddr}

That usually points to a contract-level issue.`;
  } else if (dominance >= 0.3) {
    insightLine = `Failures are spreading across multiple contracts, with one leading at ${dominancePct}%:
${topAddr}

This may signal broader instability.`;
  } else {
    insightLine = `Failures are distributed across multiple contracts.

No single dominant source detected — this suggests network-wide stress.`;
  }

  return `🐦 ArcSense Update

Failure rate is now ${failureRate}% on testnet.

${totalFailed} failed transactions — not alarming at first.

But here’s the signal:
${insightLine}

Tracking real testnet behavior > farming noise.

#Arc #Testnet #Web3`;
}