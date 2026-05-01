export function generateThread(report: any) {
  const failureRate = (report.avgFailureRate * 100).toFixed(2);
  const totalFailed = report.totalFailed;

  const tweets: string[] = [];

  tweets.push(
    `1/ Failure patterns are shifting on testnet — here’s what’s happening 👇`
  );

  tweets.push(
    `2/ I analyzed the last ${report.blocksAnalyzed} blocks:
→ ${report.totalTransactions} transactions
→ ${failureRate}% failure rate`
  );

  tweets.push(
    `3/ ${totalFailed} failed transactions — doesn’t look alarming at first.`
  );

  if (totalFailed > 0) {
    const [topAddr, topCount] = report.topFailingContracts[0];
    const dominance = topCount / totalFailed;
    const dominancePct = Math.round(dominance * 100);

    if (dominance >= 0.8) {
      tweets.push(
        `4/ One contract caused ${dominancePct}% of failures:
${topAddr}`
      );
    } else if (dominance >= 0.3) {
      tweets.push(
        `4/ Failures are spreading across contracts.

Top contributor:
${topAddr} (${dominancePct}%)`
      );
    } else {
      tweets.push(
        `4/ Failures are distributed — no single dominant contract.

This points to broader network-level issues.`
      );
    }
  }

  tweets.push(
    `5/ This usually points to:
• Contract bugs
• Integration issues
• Misuse patterns`
  );

  tweets.push(
    `6/ Raw transaction counts don’t tell the full story.

Tracking failures > tracking activity.`
  );

  tweets.push(
    `7/ I’m building ArcSense to surface signals like this automatically.

If you’re exploring testnet seriously, this kind of data matters.`
  );

  return tweets.join("\n\n");
}