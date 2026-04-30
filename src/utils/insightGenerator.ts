export function generateInsights(current: any, trendText: string) {
  let output = "\n🧠 ArcSense Insight\n\n";

  const rate = current.avgFailureRate;

  // Failure severity
  if (rate > 0.1) {
    output += `Failure rate is HIGH (${(rate * 100).toFixed(2)}%) across last ${current.blocks} blocks.\n\n`;
  } else if (rate > 0.05) {
    output += `Failure rate is moderate (${(rate * 100).toFixed(2)}%).\n\n`;
  } else {
    output += `Failure rate is low (${(rate * 100).toFixed(2)}%).\n\n`;
  }

  // Contract dominance
  if (current.topFailingContracts.length > 0) {
    const [topAddr, topCount] = current.topFailingContracts[0];

    const totalFailures = current.totalFailed;

    if (totalFailures > 0) {
      const dominance = topCount / totalFailures;

      if (dominance > 0.8) {
        output += `⚠️ A single contract is responsible for ${Math.round(
          dominance * 100
        )}% of failures:\n${topAddr}\n\n`;
      } else {
        output += `Top failing contract:\n${topAddr} (${topCount} failures)\n\n`;
      }
    }
  }

  // Trend summary (simplified)
  if (trendText.includes("increased")) {
    output += "📈 Trend: Failure rate is increasing.\n";
  } else if (trendText.includes("decreased")) {
    output += "📉 Trend: Failure rate is decreasing.\n";
  } else {
    output += "➡️ Trend: No significant change.\n";
  }

  return output;
}