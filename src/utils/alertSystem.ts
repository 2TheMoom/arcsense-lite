export function generateAlerts(current: any, trendText: string) {
  const alerts: string[] = [];

  const failureRate = current.avgFailureRate;
  const totalFailed = current.totalFailed;

  let dominantContract: string | null = null;

  if (totalFailed > 0 && current.topFailingContracts.length > 0) {
    const [addr, count] = current.topFailingContracts[0];
    const dominance = count / totalFailed;

    if (dominance >= 0.8) {
      dominantContract = addr;
      alerts.push(
        `⚠️ Contract dominating failures: ${addr} (${Math.round(
          dominance * 100
        )}%)`
      );
    }
  }

  if (failureRate >= 0.1) {
    alerts.push(`🔥 Failure spike detected (>10%)`);
  } else if (failureRate >= 0.05) {
    alerts.push(`⚠️ Elevated failure rate (>5%)`);
  }

  if (trendText.includes("increased") && failureRate >= 0.05) {
    alerts.push(`📈 Failure rate is trending upward`);
  }

  const matches = [
    ...trendText.matchAll(/New failing contract: (0x[a-fA-F0-9]+)/g),
  ];

  matches.forEach((m) => {
    const addr = m[1];
    if (addr !== dominantContract) {
      alerts.push(`🚨 New failing contract detected: ${addr}`);
    }
  });

  if (alerts.length === 0) {
    return "\n✅ No critical alerts detected.";
  }

  let output = "\n🚨 ALERTS\n\n";
  alerts.forEach((a) => (output += `${a}\n`));

  return output;
}