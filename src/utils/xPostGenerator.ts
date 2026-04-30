export function generateXPost(current: any, trendText: string) {
  const rate = (current.avgFailureRate * 100).toFixed(2);

  let post = "🐦 ArcSense Update\n\n";

  // 🔥 Stronger hook (numbers + narrative)
  if (current.avgFailureRate === 0) {
    post += `Testnet just hit 0% failure rate across the last ${current.blocks} blocks.\n\n`;
  } else if (trendText.includes("increased")) {
    post += `Failure rate just moved from a lower baseline → ${rate}% across the last ${current.blocks} blocks.\n\n`;
  } else if (trendText.includes("decreased")) {
    post += `Failure rate dropped significantly to ${rate}% across the last ${current.blocks} blocks.\n\n`;
  } else {
    post += `Testnet is holding steady at ${rate}% failure rate.\n\n`;
  }

  // 🎯 Add tension if failures exist
  if (current.totalFailed > 0) {
    post += `Only ${current.totalFailed} failed transaction${current.totalFailed > 1 ? "s" : ""} — but here’s the catch:\n\n`;

    if (current.topFailingContracts.length > 0) {
      const [addr, count] = current.topFailingContracts[0];

      post += `A single contract is responsible for most (or all) failures:\n${addr}\n(${count} failures)\n\n`;
    }
  } else {
    post += `No failed transactions detected.\n\nNetwork looks clean.\n\n`;
  }

  post += "Tracking real testnet behavior > farming noise.\n\n";
  post += "#Arc #Testnet #Web3";

  return post;
}