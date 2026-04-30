export function generateThread(current: any, trendText: string) {
  const rate = (current.avgFailureRate * 100).toFixed(2);

  const [topAddr, topCount] =
    current.topFailingContracts.length > 0
      ? current.topFailingContracts[0]
      : ["N/A", 0];

  let thread = "\n🧵 Thread Preview:\n\n";

  // 🔥 Tweet 1 (hook)
  if (current.avgFailureRate === 0) {
    thread += `1/ Testnet just hit 0% failure rate… but that’s not the full story 👇\n\n`;
  } else if (trendText.includes("increased")) {
    thread += `1/ Failure rate just spiked on testnet — here’s what’s actually happening 👇\n\n`;
  } else if (trendText.includes("decreased")) {
    thread += `1/ Testnet just stabilized… but here’s what changed 👇\n\n`;
  } else {
    thread += `1/ Testnet looks stable… but there’s a signal most people miss 👇\n\n`;
  }

  // Tweet 2
  thread += `2/ I analyzed the last ${current.blocks} blocks:\n`;
  thread += `→ ${current.totalTx} transactions\n`;
  thread += `→ ${rate}% failure rate\n\n`;

  // Tweet 3 (cleaner tone)
  thread += `3/ ${current.totalFailed} failed transaction${current.totalFailed !== 1 ? "s" : ""} — doesn’t look alarming at first.\n\n`;

  // Tweet 4
  if (current.totalFailed > 0) {
    thread += `4/ But here’s the catch:\n\n`;
    thread += `A single contract caused ${Math.round(
      (topCount / current.totalFailed) * 100
    )}% of failures:\n${topAddr}\n\n`;
  } else {
    thread += `4/ No failures detected — network is clean.\n\n`;
  }

  // Tweet 5
  if (current.totalFailed > 0) {
    thread += `5/ This usually points to:\n`;
    thread += `• Contract bug\n• Integration issue\n• Misuse pattern\n\n`;
  } else {
    thread += `5/ This suggests strong short-term network stability.\n\n`;
  }

  // Tweet 6
  thread += `6/ This is why raw transaction counts don’t tell the full story.\n\n`;
  thread += `Tracking failures > tracking activity.\n\n`;

  // Tweet 7 (strong close)
  thread += `7/ I’m building ArcSense to surface signals like this automatically.\n\n`;
  thread += `If you’re exploring the testnet seriously, this kind of data matters.`;

  return thread;
}