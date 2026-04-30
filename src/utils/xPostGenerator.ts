export function generateXPost(current: any, trendText: string) {
  const rate = (current.avgFailureRate * 100).toFixed(2);

  let post = "🐦 ArcSense Update\n\n";

  // 🔥 Smarter hook
  if (current.avgFailureRate === 0) {
    post += `Testnet just hit 0% failure rate across the last ${current.blocks} blocks.\n`;
  } else if (trendText.includes("increased")) {
    post += `Failure rate is rising on testnet.\n`;
  } else if (trendText.includes("decreased")) {
    post += `Failure rate is dropping on testnet.\n`;
  } else {
    post += `Testnet activity remains stable.\n`;
  }

  post += `\nCurrent failure rate: ${rate}% across last ${current.blocks} blocks.\n\n`;

  // Contract highlight
  if (current.topFailingContracts.length > 0) {
    const [addr, count] = current.topFailingContracts[0];

    post += `Top failing contract:\n${addr}\n(${count} failures)\n\n`;
  } else {
    post += `No failing contracts detected.\n\n`;
  }

  post += "Tracking real testnet behavior > farming noise.\n\n";
  post += "#Arc #Testnet #Web3";

  return post;
}