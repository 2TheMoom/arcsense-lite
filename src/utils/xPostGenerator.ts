export function generateXPost(current: any, trendText: string) {
  const rate = (current.avgFailureRate * 100).toFixed(2);

  let post = "🐦 ArcSense Update\n\n";

  // 🔥 Strong, punchy hooks
  if (current.avgFailureRate === 0) {
    post += `Testnet just hit 0% failure rate across the last ${current.blocks} blocks.\n\n`;
  } else if (trendText.includes("increased")) {
    post += `Failure rate just spiked to ${rate}% on testnet.\n\n`;
  } else if (trendText.includes("decreased")) {
    post += `Failure rate dropped to ${rate}% across the last ${current.blocks} blocks.\n\n`;
  } else {
    post += `Testnet is holding steady at ${rate}% failure rate.\n\n`;
  }

  // 🎯 Add tension + clarity
  if (current.totalFailed > 0) {
    post += `${current.totalFailed} failed transaction${current.totalFailed > 1 ? "s" : ""} — not alarming at first.\n\n`;

    if (current.topFailingContracts.length > 0) {
      const [addr, count] = current.topFailingContracts[0];

      post += `But here’s the signal:\n`;
      post += `One contract is responsible for ${Math.round((count / current.totalFailed) * 100)}% of failures:\n`;
      post += `${addr}\n\n`;
    }

    post += `That usually points to a contract-level issue, not random noise.\n\n`;
  } else {
    post += `No failed transactions detected.\n\nNetwork looks clean.\n\n`;
  }

  post += "Tracking real testnet behavior > farming noise.\n\n";
  post += "#Arc #Testnet #Web3";

  return post;
}