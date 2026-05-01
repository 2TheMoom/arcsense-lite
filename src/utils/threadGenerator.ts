export function generateThread(report: any): string[] {
  const total = report.total || 0;
  const failed = report.failed || 0;

  const percent = total === 0
    ? "0.00"
    : ((failed / total) * 100).toFixed(2);

  const [topContract, topCount] =
    report.topFailingContracts?.[0] || ["N/A", 0];

  const dominance =
    failed === 0 ? 0 : Math.round((topCount / failed) * 100);

  const signal =
    parseFloat(percent) > 10
      ? "Elevated failure rate → worth watching closely."
      : parseFloat(percent) > 3
      ? "Moderate failure rate → early signal forming."
      : "Low failure rate → system is stable.";

  return [
    "1/ Most people track activity.\n\nI track failure patterns.\n\nHere’s why 👇",

    `2/ Last 5 blocks:\n→ ${total} transactions\n→ ${percent}% failure rate\n\nFailure rate is starting to move.`,

    failed > 0
      ? `3/ The real signal:\n\n${dominance}% of failures come from ONE contract:\n${topContract}\n\nThat’s not random.`
      : "3/ No failed transactions detected.\n\nSystem is clean.",

    "4/ When failures cluster like this, it usually means:\n• Contract bug\n• Broken integration\n• Misuse patterns",

    "5/ This is how issues begin.\n\nNot with spikes — but with concentrated signals.",

    `6/ Current state:\n${signal}`,

    "7/ This is why I built ArcSense.\n\nNot to track noise —\nbut to surface early signals.",

    "8/ If you're serious about testnet:\n\nWatch failures.\nIgnore activity."
  ];
}