import { useState, useEffect, useRef } from "react";

const API            = "https://arcsense-lite-production.up.railway.app";
const SERVICE_WALLET = "0xb0717528602bc5bd26e143445a87846b2a5f6218";

// ── Brand tokens ──────────────────────────────────────────────
// navy/navyL/navyG now carry Arc's institutional blue (blended palette).
// arc1-4 + arcGrad are Arc's real four-stop background gradient,
// used only on structural surfaces (top bar, CTA banner) — not smeared
// across every panel.
const C = {
  bg:      "#E9E6DF",
  bgDeep:  "#DDDAD3",
  panel:   "#F0EDE7",
  border:  "#C8C4BB",
  borderL: "#D8D4CC",
  charcoal:"#161719",
  text:    "#1A1C22",
  muted:   "#7A7870",
  mutedL:  "#A8A49C",
  navy:    "#123D72",
  navyL:   "#2D5C8E",
  navyG:   "rgba(18,61,114,0.07)",
  arcAccent:  "#123D72",
  arcAccentL: "#2D5C8E",
  arcAccentG: "rgba(18,61,114,0.07)",
  arc1: "#021A49",
  arc2: "#123D72",
  arc3: "#2D5C8E",
  arc4: "#5CAFB8",
  arcGrad: "linear-gradient(180deg, #021A49 0%, #123D72 35%, #2D5C8E 70%, #5CAFB8 100%)",
  crimson: "#B01C2E",
  crimsonG:"rgba(176,28,46,0.07)",
  crimsonZ:"rgba(176,28,46,0.04)",
  amber:   "#8A6010",
  amberG:  "rgba(138,96,16,0.07)",
  amberZ:  "rgba(138,96,16,0.04)",
  white:   "#FAFAF8",
  green:   "#1A6B3C",
  greenG:  "rgba(26,107,60,0.07)",
};

// ── Responsive hook ───────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── Helpers ───────────────────────────────────────────────────
function shortAddr(addr) {
  if (!addr || addr === "unknown") return "unknown";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function explorerUrl(addr) {
  return `https://testnet.arcscan.app/address/${addr}`;
}

function isRealAddr(addr) {
  return addr && addr !== "unknown" && addr.startsWith("0x") && addr.length > 10;
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function severityColor(rate) {
  if (rate >= 0.10) return C.crimson;
  if (rate >= 0.05) return C.amber;
  if (rate >= 0.02) return C.navy;
  return C.green;
}

// ── Behavior classification ───────────────────────────────────
function classifyContract(addr, totalFailures, blocksAppearedIn, totalBlocks, firstSeen, lastSeen) {
  const recentBlocks    = totalBlocks > 0 ? lastSeen >= totalBlocks - 5 : false;
  const blockSpread     = blocksAppearedIn;
  const failurePerBlock = blocksAppearedIn > 0 ? totalFailures / blocksAppearedIn : 0;
  if (totalFailures >= 10 && failurePerBlock >= 2)
    return { label: "HIGH FREQUENCY FAILER", icon: "📛", color: C.crimson, bg: C.crimsonG };
  if (blockSpread >= 5)
    return { label: "REPEAT OFFENDER", icon: "⚠️", color: C.amber, bg: C.amberG };
  if (recentBlocks && totalFailures >= 2)
    return { label: "NEW FAILURE", icon: "🆕", color: C.navyL, bg: C.navyG };
  if (failurePerBlock >= 1.5)
    return { label: "RECURRING PATTERN", icon: "🔄", color: C.amber, bg: C.amberG };
  return { label: "OCCASIONAL FAILURE", icon: "🔍", color: C.muted, bg: "transparent" };
}

function buildContractHistory(blocks) {
  const history = {};
  blocks.forEach((b, idx) => {
    for (const [addr, count] of Object.entries(b.topFailing || {})) {
      if (!history[addr]) history[addr] = { total: 0, blocks: [], firstIdx: idx, lastIdx: idx };
      history[addr].total += count;
      history[addr].blocks.push(b.blockNumber);
      history[addr].lastIdx = idx;
    }
  });
  return history;
}

// ── Gateway mark — silver gateway shape + ArcSense diamond core ─
function GatewayMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <defs>
        <linearGradient id="chromeGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#F4F5F7" />
          <stop offset="35%"  stopColor="#C7CCD3" />
          <stop offset="65%"  stopColor="#8A9099" />
          <stop offset="100%" stopColor="#5B6168" />
        </linearGradient>
      </defs>
      <path d="M32,140 Q40,80 76,38" stroke="url(#chromeGradient)" strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M128,140 Q120,80 84,38" stroke="url(#chromeGradient)" strokeWidth="15" strokeLinecap="round" fill="none" />
      <rect x="66" y="92" width="28" height="28" transform="rotate(45 80 106)" fill="url(#chromeGradient)" />
      <rect x="73" y="99" width="14" height="14" transform="rotate(45 80 106)" fill={C.arc1} />
      <circle cx="80" cy="106" r="4" fill={C.green} />
      <circle cx="80" cy="40" r="5" fill={C.green} />
    </svg>
  );
}

// ── HUD corners ───────────────────────────────────────────────
function Corners({ color = C.navy, size = 14 }) {
  const s = { position: "absolute", pointerEvents: "none" };
  const p = { stroke: color, strokeWidth: 1.5, fill: "none" };
  return (
    <>
      <svg width={size} height={size} style={{ ...s, top: -1, left: -1 }}><path d={`M ${size} 2 L 2 2 L 2 ${size}`} {...p} /></svg>
      <svg width={size} height={size} style={{ ...s, top: -1, right: -1 }}><path d={`M 2 2 L ${size-2} 2 L ${size-2} ${size}`} {...p} /></svg>
      <svg width={size} height={size} style={{ ...s, bottom: -1, left: -1 }}><path d={`M 2 2 L 2 ${size-2} L ${size} ${size-2}`} {...p} /></svg>
      <svg width={size} height={size} style={{ ...s, bottom: -1, right: -1 }}><path d={`M 2 ${size} L ${size-2} ${size-2} L ${size-2} 2`} {...p} /></svg>
    </>
  );
}

function HudPanel({ children, style = {}, accent = C.navy, label = "" }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 1, position: "relative", ...style }}>
      <Corners color={accent} />
      {label && (
        <div style={{ position: "absolute", top: -9, left: 14, background: C.bg, padding: "0 8px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: accent, fontWeight: 600 }}>{label}</div>
      )}
      {children}
    </div>
  );
}

// ── Trend logic ───────────────────────────────────────────────
function getTrend(history) {
  if (history.length < 4) return "INSUFFICIENT DATA";
  const recent  = history.slice(-5).map(b => b.failureRate);
  const avg     = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prev    = history.slice(-10, -5).map(b => b.failureRate);
  const prevAvg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : avg;
  if (avg > prevAvg + 0.02) return "FAILURE RATE RISING";
  if (avg < prevAvg - 0.02) return "FAILURE RATE DROPPING";
  return "STABLE ACTIVITY";
}

// ── Filter badge ──────────────────────────────────────────────
function FilterBadge({ addr, classification, onClear }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: classification.bg, border: `1px solid ${classification.color}44`, padding: "6px 12px", flexShrink: 0, animation: "fadeIn 0.3s ease" }}>
      <span style={{ fontSize: 12 }}>{classification.icon}</span>
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL }}>FILTERING BY CONTRACT</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: classification.color, fontWeight: 700 }}>{shortAddr(addr)}</div>
      </div>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 1, color: classification.color, marginLeft: 4 }}>{classification.label}</span>
      <button onClick={onClear} style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.borderL}`, color: C.muted, cursor: "pointer", fontSize: 10, padding: "2px 8px", borderRadius: 1, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 1 }}>✕ CLEAR</button>
    </div>
  );
}

// ── Scoped stats ──────────────────────────────────────────────
function ScopedStatsRow({ blocks, selectedContract, isMobile }) {
  const relevantBlocks = blocks.filter(b => b.topFailing?.[selectedContract]);
  const totalFailures  = relevantBlocks.reduce((s, b) => s + (b.topFailing?.[selectedContract] || 0), 0);
  const failureRate    = relevantBlocks.length > 0
    ? ((totalFailures / relevantBlocks.reduce((s, b) => s + b.totalTx, 0)) * 100).toFixed(2)
    : "0.00";
  const firstBlock = relevantBlocks[0]?.blockNumber;
  const lastBlock  = relevantBlocks[relevantBlocks.length - 1]?.blockNumber;
  const rateFloat  = parseFloat(failureRate);
  const stats = [
    { label: "BLOCKS APPEARED IN", value: relevantBlocks.length.toString(), sub: "affected blocks",        size: 24, accent: C.navy,    color: C.charcoal },
    { label: "TOTAL FAILURES",     value: totalFailures.toString(),          sub: "caused by contract",     size: totalFailures > 5 ? 30 : 24, accent: totalFailures > 0 ? C.crimson : C.navy, color: totalFailures > 0 ? C.crimson : C.charcoal, bg: totalFailures > 0 ? C.crimsonG : "transparent" },
    { label: "CONTRACT FAIL RATE", value: `${failureRate}%`,                 sub: "of txs in those blocks", size: rateFloat >= 10 ? 30 : 24, accent: rateFloat >= 10 ? C.crimson : rateFloat >= 5 ? C.amber : C.navy, color: rateFloat >= 10 ? C.crimson : rateFloat >= 5 ? C.amber : C.charcoal, bg: rateFloat >= 10 ? C.crimsonG : rateFloat >= 5 ? C.amberG : "transparent" },
    { label: "FIRST SEEN", value: firstBlock ? `#${firstBlock.toLocaleString()}` : "—", sub: "block number", size: 16, accent: C.navy, color: C.charcoal },
    { label: "LAST SEEN",  value: lastBlock  ? `#${lastBlock.toLocaleString()}`  : "—", sub: "block number", size: 16, accent: C.navy, color: C.charcoal, spanFull: true },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: isMobile ? 8 : 10, flexShrink: 0 }}>
      {stats.map((s, i) => (
        <HudPanel key={i} accent={s.accent} style={{ padding: isMobile ? "12px 14px" : "14px 18px", background: s.bg || C.panel, gridColumn: isMobile && s.spanFull ? "1 / -1" : "auto" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: s.color === C.charcoal ? C.mutedL : s.color, marginBottom: 6, opacity: 0.8 }}>{s.label}</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isMobile ? s.size - 2 : s.size, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL, marginTop: 4 }}>{s.sub}</div>
        </HudPanel>
      ))}
    </div>
  );
}

// ── Global stats row ──────────────────────────────────────────
function StatsRow({ blocks, isMobile, meta, agentStatus }) {
  const total    = blocks.reduce((s, b) => s + b.totalTx, 0);
  const failed   = blocks.reduce((s, b) => s + b.failedTx, 0);
  const avgRate  = blocks.length ? (blocks.reduce((s, b) => s + b.failureRate, 0) / blocks.length * 100).toFixed(2) : "0.00";
  const avgFloat = parseFloat(avgRate);
  const blocksScanned   = meta.totalBlocksScanned || blocks.length;
  const alertsTriggered = meta.totalAlertsTriggered || 0;
  const agentRuns       = agentStatus?.totalCycles || 0;
  const usdcSpent       = agentStatus?.totalUsdcSpent || 0;
  const stats = [
    { label: "BLOCKS SCANNED",     value: blocksScanned.toLocaleString(),  sub: "processed",   size: 24, accent: C.navy,    color: C.charcoal },
    { label: "TOTAL TRANSACTIONS", value: total.toLocaleString(),           sub: "on-chain",    size: 24, accent: C.navy,    color: C.charcoal },
    { label: "TOTAL FAILURES",     value: failed.toLocaleString(),          sub: "detected",    size: failed > 0 ? 30 : 24, accent: failed > 0 ? C.crimson : C.navy, color: failed > 0 ? C.crimson : C.charcoal, bg: failed > 0 ? C.crimsonG : "transparent" },
    { label: "AVG FAILURE RATE",   value: `${avgRate}%`,                    sub: "rolling avg", size: avgFloat >= 10 ? 30 : avgFloat >= 5 ? 28 : 24, accent: avgFloat >= 10 ? C.crimson : avgFloat >= 5 ? C.amber : C.navy, color: avgFloat >= 10 ? C.crimson : avgFloat >= 5 ? C.amber : C.charcoal, bg: avgFloat >= 10 ? C.crimsonG : avgFloat >= 5 ? C.amberG : "transparent" },
    { label: "ALERTS TRIGGERED",   value: alertsTriggered.toLocaleString(), sub: "≥10% spikes", size: alertsTriggered > 0 ? 30 : 24, accent: alertsTriggered > 0 ? C.crimson : C.navy, color: alertsTriggered > 0 ? C.crimson : C.charcoal, bg: alertsTriggered > 0 ? C.crimsonG : "transparent" },
    { label: "AGENT CYCLES",       value: agentRuns.toLocaleString(),       sub: "autonomous",  size: agentRuns > 0 ? 26 : 24, accent: C.green, color: agentRuns > 0 ? C.green : C.charcoal, bg: agentRuns > 0 ? C.greenG : "transparent" },
    { label: "USDC SPENT",         value: `$${usdcSpent.toFixed(2)}`,       sub: "by agent",    size: usdcSpent > 0 ? 26 : 24, accent: usdcSpent > 0 ? C.green : C.navy, color: usdcSpent > 0 ? C.green : C.charcoal, bg: usdcSpent > 0 ? C.greenG : "transparent", spanFull: true },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(7,1fr)", gap: isMobile ? 8 : 10, flexShrink: 0 }}>
      {stats.map((s, i) => (
        <HudPanel key={i} accent={s.accent} style={{ padding: isMobile ? "10px 12px" : "12px 14px", background: s.bg || C.panel, gridColumn: isMobile && s.spanFull ? "1 / -1" : "auto" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: s.color === C.charcoal ? C.mutedL : s.color, marginBottom: 5, opacity: 0.8 }}>{s.label}</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isMobile ? s.size - 4 : s.size - 2, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL, marginTop: 4 }}>{s.sub}</div>
        </HudPanel>
      ))}
    </div>
  );
}

// ── Block feed ────────────────────────────────────────────────
function BlockFeed({ blocks, isMobile, selectedContract }) {
  const ref      = useRef(null);
  const filtered = selectedContract ? blocks.filter(b => b.topFailing?.[selectedContract]) : blocks;
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [filtered]);
  return (
    <HudPanel label={selectedContract ? `FILTERED · ${shortAddr(selectedContract)}` : "BLOCK FEED"} accent={selectedContract ? C.crimson : C.navy} style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: isMobile ? 300 : "100%", minHeight: 0 }}>
      <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: selectedContract ? C.crimson : C.mutedL }}>{selectedContract ? "CONTRACT VIEW" : "LIVE STREAM"}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{filtered.length}</span>
      </div>
      <div ref={ref} style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {filtered.length === 0
          ? <div style={{ padding: "24px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL }}>No blocks found for this contract.</div>
          : filtered.slice(-60).map((b, i, arr) => {
              const isNew  = !selectedContract && i >= arr.length - 3;
              const isCrit = b.failureRate >= 0.15;
              const isWarn = b.failureRate >= 0.10;
              const contractFails = selectedContract ? (b.topFailing?.[selectedContract] || 0) : 0;
              const rowBg  = isCrit ? C.crimsonG : isWarn ? C.amberG : isNew ? C.navyG : "transparent";
              const topEntry = !selectedContract ? Object.entries(b.topFailing || {}).sort((a, z) => z[1] - a[1])[0] : null;
              const topAddr  = topEntry?.[0] || null;
              return (
                <div key={b.blockNumber} style={{ padding: "7px 16px", borderLeft: `2px solid ${isCrit ? C.crimson : isWarn ? C.amber : isNew ? C.navy : selectedContract ? C.crimson + "66" : C.borderL}`, background: rowBg, transition: "background 0.8s", animation: i === arr.length - 1 ? "fadeIn 0.4s ease" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isCrit ? C.crimson : isNew ? C.navy : C.muted }}>#{b.blockNumber.toLocaleString()}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{b.totalTx}tx</span>
                      {selectedContract
                        ? <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1, color: C.crimson }}>{contractFails} FAIL</span>
                        : <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isCrit || isWarn ? 12 : 11, letterSpacing: 1, color: isCrit ? C.crimson : isWarn ? C.amber : C.navy }}>{b.failedTx > 0 ? `${b.failedTx} FAIL` : "OK"}</span>
                      }
                    </div>
                  </div>
                  {topAddr && !selectedContract && (
                    <div style={{ marginTop: 2 }}>
                      {isRealAddr(topAddr)
                        ? <a href={explorerUrl(topAddr)} target="_blank" rel="noopener noreferrer" title={topAddr} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: isCrit ? C.crimson : C.amber, textDecoration: "none", borderBottom: `1px dashed ${isCrit ? C.crimson : C.amber}44` }}>{shortAddr(topAddr)}</a>
                        : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>unknown</span>
                      }
                    </div>
                  )}
                </div>
              );
            })}
      </div>
    </HudPanel>
  );
}

// ── Network Pulse — replaces the line chart ─────────────────────
// Radial gauge for current failure rate + a 15-block heat strip.
// No charting library — pure SVG, computed from the same blocks array.
function NetworkPulse({ blocks, isMobile, selectedContract }) {
  const recent = blocks.slice(-30);
  const last   = recent[recent.length - 1];

  const rateFor = (b) =>
    selectedContract
      ? (b.totalTx > 0 ? (b.topFailing?.[selectedContract] || 0) / b.totalTx : 0)
      : b.failureRate;

  const currentRate = last ? rateFor(last) : 0;

  const windowSlice = recent.slice(-10);
  const avgRate = windowSlice.length
    ? windowSlice.reduce((s, b) => s + rateFor(b), 0) / windowSlice.length
    : 0;

  const heatBlocks = recent.slice(-15);
  const gaugeColor = severityColor(currentRate);

  const r              = 52;
  const circumference  = 2 * Math.PI * r;
  const trackFraction  = 0.75; // 270° arc, 90° gap at the bottom
  const trackLength    = circumference * trackFraction;
  const maxScale       = 0.20; // gauge reads "full" at 20% failure rate
  const valueFraction  = Math.min(currentRate / maxScale, 1);
  const valueLength    = currentRate > 0 ? Math.max(trackLength * valueFraction, 4) : 0;

  return (
    <HudPanel
      label={selectedContract ? `CONTRACT PULSE · ${shortAddr(selectedContract)}` : "NETWORK PULSE"}
      accent={selectedContract ? C.crimson : C.navy}
      style={{ display: "flex", flexDirection: "column", height: isMobile ? "auto" : "100%", overflow: "hidden", minHeight: 0 }}
    >
      <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL }}>30 BLOCK WINDOW</span>
      </div>

      <div style={{ flex: isMobile ? "none" : 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "18px 12px" }}>
        <div style={{ position: "relative", width: 116, height: 116 }}>
          <svg width="116" height="116" viewBox="0 0 140 140">
            <g transform="rotate(135 70 70)">
              <circle cx="70" cy="70" r={r} fill="none" stroke={C.borderL} strokeWidth="9" strokeDasharray={`${trackLength} ${circumference}`} strokeLinecap="round" />
              <circle cx="70" cy="70" r={r} fill="none" stroke={gaugeColor} strokeWidth="9" strokeDasharray={`${valueLength} ${circumference}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease" }} />
            </g>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 21, color: gaugeColor, lineHeight: 1 }}>{(currentRate * 100).toFixed(1)}%</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6, letterSpacing: 1.5, color: C.mutedL, marginTop: 2 }}>CURRENT</div>
          </div>
        </div>

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>ROLLING AVG · {(avgRate * 100).toFixed(1)}%</div>

        <div style={{ display: "flex", gap: 2 }}>
          {heatBlocks.length === 0
            ? <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>awaiting data...</span>
            : heatBlocks.map((b, i) => {
                const rate = rateFor(b);
                return (
                  <div
                    key={b.blockNumber || i}
                    title={`#${b.blockNumber} · ${(rate * 100).toFixed(1)}%`}
                    style={{ width: 8, height: 22, background: severityColor(rate), flexShrink: 0, transition: "background 0.4s ease" }}
                  />
                );
              })
          }
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6, letterSpacing: 1.5, color: C.mutedL }}>LAST {heatBlocks.length} BLOCKS</div>
      </div>

      <div style={{ display: "flex", gap: 12, padding: "8px 16px 12px", borderTop: `1px solid ${C.borderL}`, flexShrink: 0, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { color: C.green,   label: "HEALTHY"  },
          { color: C.navy,    label: "NORMAL"   },
          { color: C.amber,   label: "WARNING"  },
          { color: C.crimson, label: "CRITICAL" },
        ].map(t => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 7, height: 7, background: t.color }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: 1, color: t.color }}>{t.label}</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

// ── Contracts panel — expanded table ────────────────────────────
function ContractsPanel({ blocks, isMobile, selectedContract, onSelectContract }) {
  const contractHistory = buildContractHistory(blocks);
  const sorted = Object.entries(contractHistory).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const gridCols = isMobile ? "24px 1fr 110px" : "26px 1fr 150px 60px 60px";

  return (
    <HudPanel label="CONTRACT INTELLIGENCE" style={{ display: "flex", flexDirection: "column", height: isMobile ? "auto" : "100%", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL }}>FAILURE ACCUMULATION</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{sorted.length} tracked</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 8, padding: "7px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: 1.5, color: C.mutedL, borderBottom: `1px solid ${C.borderL}`, flexShrink: 0 }}>
        <span></span>
        <span>CONTRACT</span>
        <span>CLASSIFICATION</span>
        <span style={{ display: isMobile ? "none" : "block" }}>BLOCKS</span>
        <span style={{ display: isMobile ? "none" : "block" }}>FAILS</span>
      </div>

      <div style={{ flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto", minHeight: 0 }}>
        {sorted.length === 0
          ? <div style={{ padding: "24px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL }}>No failures yet.</div>
          : sorted.map(([addr, data], i) => {
              const count          = data.total;
              const blockSpread    = data.blocks.length;
              const classification = classifyContract(addr, count, blockSpread, blocks.length, data.firstIdx, data.lastIdx);
              const isSelected     = selectedContract === addr;
              const canClick       = isRealAddr(addr);
              const rankBg         = classification.color === C.muted ? C.mutedL : classification.color;

              return (
                <div
                  key={addr}
                  onClick={() => onSelectContract(isSelected ? null : addr)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridCols,
                    gap: 8,
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: `1px solid ${C.borderL}44`,
                    borderLeft: isSelected ? `3px solid ${classification.color}` : "3px solid transparent",
                    background: isSelected ? `${classification.color}12` : "transparent",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.navyG; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${classification.color}12` : "transparent"; }}
                >
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, fontWeight: 700, color: C.white, background: rankBg, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>

                  {canClick
                    ? <a href={explorerUrl(addr)} target="_blank" rel="noopener noreferrer" title={addr} onClick={e => e.stopPropagation()} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: classification.color, textDecoration: "none", borderBottom: `1px dashed ${classification.color}66` }}>{shortAddr(addr)}</a>
                    : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: C.muted }}>{addr}</span>
                  }

                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: 1, padding: "2px 6px", background: classification.bg, color: classification.color, width: "fit-content", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                    {classification.icon} {classification.label}
                  </span>

                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL, display: isMobile ? "none" : "block" }}>{blockSpread}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: classification.color, display: isMobile ? "none" : "block" }}>{count}</span>
                </div>
              );
            })}
      </div>
    </HudPanel>
  );
}

// ── Agent Intelligence panel ──────────────────────────────────
function AgentPanel({ agentStatus, agentLog, isMobile, onTrigger, triggering }) {
  // ── RUNNING status fix ────────────────────────────────────
  // If status is RUNNING but agent is not being manually triggered,
  // show IDLE — the flag is stuck from a previous cycle
  const status         = triggering ? "RUNNING" : (agentStatus?.status || "IDLE");
  const displayStatus  = (status === "RUNNING" && !triggering) ? "IDLE" : status;
  const statusColor    = displayStatus === "RUNNING" ? C.green : displayStatus === "ERROR" ? C.crimson : C.muted;
  const displayLog     = isMobile ? (agentLog || []).slice(0, 5) : (agentLog || []).slice(0, 10);

  return (
    <HudPanel label="AGENT INTELLIGENCE" accent={C.green} style={{ display: "flex", flexDirection: "column", height: isMobile ? "auto" : "100%", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, animation: displayStatus === "RUNNING" ? "blink 1s ease-in-out infinite" : "none" }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 9, letterSpacing: 3, color: statusColor, fontWeight: 700 }}>{displayStatus}</span>
        </div>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 2, color: C.mutedL }}>AUTONOMOUS</span>
      </div>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderL}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flexShrink: 0 }}>
        {[
          { label: "CYCLES",     value: agentStatus?.totalCycles?.toString() || "0" },
          { label: "PAID",       value: agentStatus?.totalPaid?.toString() || "0" },
          { label: "USDC SPENT", value: `$${(agentStatus?.totalUsdcSpent || 0).toFixed(2)}` },
          { label: "LAST RUN",   value: timeAgo(agentStatus?.lastRunAt) },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL }}>{s.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.charcoal, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: isMobile ? "none" : 1, overflowY: isMobile ? "visible" : "auto", minHeight: 0 }}>
        <div style={{ padding: "8px 14px 4px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 3, color: C.mutedL }}>DECISION LOG</div>
        {displayLog.length === 0
          ? <div style={{ padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>Awaiting first cycle...</div>
          : displayLog.map((d, i) => {
              const isPaid      = d.paid;
              const urgency     = d.data?.decision?.urgency || "LOW";
              const rowBg       = isPaid ? C.greenG : "transparent";
              const borderCol   = isPaid ? C.green : C.borderL;
              const explorerLink = d.data?.explorerUrl && d.data.explorerUrl.includes("/tx/0x")
                ? d.data.explorerUrl
                : d.txId && d.txId.startsWith("0x")
                  ? `https://testnet.arcscan.app/tx/${d.txId}`
                  : null;
              return (
                <div key={d.id || i} style={{ padding: "8px 14px", borderBottom: `1px solid ${C.borderL}33`, borderLeft: `2px solid ${borderCol}`, background: rowBg, animation: i === 0 ? "fadeIn 0.4s ease" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
                      <span style={{ fontSize: 9 }}>{urgency === "CRITICAL" ? "🔴" : urgency === "HIGH" ? "🟠" : urgency === "MEDIUM" ? "🟡" : "🟢"}</span>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 1, color: isPaid ? C.green : C.muted, fontWeight: isPaid ? 700 : 400, lineHeight: 1.3, flex: 1 }}>
                        {isPaid ? `PAID $${d.amountPaid} USDC` : "NO ACTION"}
                      </span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL, whiteSpace: "nowrap" }}>{timeAgo(d.timestamp)}</span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL, marginTop: 3, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.reasoning?.slice(0, 60)}{d.reasoning?.length > 60 ? "..." : ""}
                  </div>
                  {d.txId && (
                    <div style={{ marginTop: 3 }}>
                      {explorerLink
                        ? <a href={explorerLink} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.green, textDecoration: "none", borderBottom: `1px dashed ${C.green}`, display: "inline-flex", alignItems: "center", gap: 3 }}>🔗 view on Arc Explorer</a>
                        : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL }}>tx: {d.txId.slice(0, 8)}...</span>
                      }
                    </div>
                  )}
                </div>
              );
            })}
      </div>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.borderL}`, flexShrink: 0 }}>
        <button onClick={onTrigger} disabled={triggering} style={{ width: "100%", background: triggering ? C.bgDeep : C.green, border: `1px solid ${triggering ? C.border : C.green}`, color: triggering ? C.muted : C.white, fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, letterSpacing: 3, fontWeight: 700, padding: "8px 0", cursor: triggering ? "not-allowed" : "pointer", borderRadius: 1, transition: "all 0.2s" }}>
          {triggering ? "⏳ RUNNING..." : "▶ TRIGGER MANUALLY"}
        </button>
      </div>
    </HudPanel>
  );
}

// ── Weekly Reports Modal ──────────────────────────────────────
function WeeklyReportsModal({ onClose, isMobile }) {
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeekly = async () => {
      try {
        const res  = await fetch(`${API}/reports/weekly`);
        const json = await res.json();
        setReport(json);
      } catch (err) {
        console.error("Failed to fetch weekly report:", err);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    fetchWeekly();
  }, []);

  const healthColor = report
    ? report.healthScore >= 80 ? C.green : report.healthScore >= 50 ? C.amber : C.crimson
    : C.muted;

  const healthLabel = report
    ? report.healthScore >= 80 ? "HEALTHY" : report.healthScore >= 50 ? "MODERATE" : "DEGRADED"
    : "—";

  const fmt = (n) => n != null ? Number(n).toLocaleString() : "—";
  const pct = (n) => n != null ? `${(n * 100).toFixed(2)}%` : "—";

  const periodStart = report?.period?.start ? new Date(report.period.start).toDateString() : null;
  const periodEnd   = report?.period?.end   ? new Date(report.period.end).toDateString()   : null;

  const topContracts = report?.topContracts
    ? Object.entries(report.topContracts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", background: "rgba(22,23,25,0.6)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, width: isMobile ? "100%" : 560, maxHeight: isMobile ? "90dvh" : "85vh", overflowY: "auto", position: "relative", animation: isMobile ? "slideUp 0.3s ease" : "fadeIn 0.2s ease" }}>
        <Corners color={C.navy} size={16} />
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: C.charcoal }}>WEEKLY REPORT</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, marginTop: 2 }}>
              {periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : "auto-generated every 7 days"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.borderL}`, color: C.muted, cursor: "pointer", fontSize: 12, padding: "3px 9px", fontFamily: "'Space Grotesk', sans-serif" }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL }}>Loading weekly report...</div>
          </div>
        ) : !report || report.error ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>NO REPORT YET</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL, lineHeight: 1.8 }}>
              Weekly reports are generated automatically every 7 days.<br />
              The first report will appear here after the first full week of data.
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.borderL}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 4 }}>NETWORK HEALTH SCORE</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 44, color: healthColor, lineHeight: 1 }}>{report.healthScore}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: C.mutedL }}>/100</div>
                </div>
              </div>
              <div style={{ background: `${healthColor}14`, border: `1px solid ${healthColor}44`, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 2, color: healthColor }}>{healthLabel}</div>
              </div>
            </div>

            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderL}`, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { label: "BLOCKS ANALYZED",   value: fmt(report.totalBlocks),    color: C.navy    },
                { label: "TOTAL TXS",         value: fmt(report.totalTx),        color: C.navy    },
                { label: "TOTAL FAILURES",    value: fmt(report.totalFailed),    color: report.totalFailed > 0 ? C.crimson : C.navy },
                { label: "AVG FAILURE RATE",  value: pct(report.avgFailureRate), color: C.amber   },
                { label: "PEAK FAILURE RATE", value: pct(report.maxFailureRate), color: C.crimson },
                { label: "ALERT BLOCKS",      value: fmt(report.alertBlocks),    color: report.alertBlocks > 0 ? C.amber : C.navy },
              ].map(s => (
                <div key={s.label} style={{ background: C.bg, border: `1px solid ${C.borderL}`, padding: "10px 12px" }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL }}>{s.label}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: s.color, marginTop: 2, lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {report.worstBlock && (
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderL}` }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 8 }}>MOST VOLATILE BLOCK</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.crimsonG, border: `1px solid ${C.crimson}44`, padding: "10px 14px" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.crimson, fontWeight: 700 }}>#{fmt(report.worstBlock.blockNumber)}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, color: C.mutedL }}>—</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: C.crimson }}>{pct(report.worstBlock.failureRate)}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, color: C.mutedL }}>failure rate</span>
                </div>
              </div>
            )}

            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderL}` }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 8 }}>TOP FAILING CONTRACTS</div>
              {topContracts.length === 0
                ? <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL }}>No contract failures recorded.</div>
                : topContracts.map(([addr, count], i) => {
                    const intensity = count / (topContracts[0][1] || 1);
                    const barColor  = intensity > 0.7 ? C.crimson : intensity > 0.4 ? C.amber : C.navy;
                    return (
                      <div key={addr} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < topContracts.length - 1 ? `1px solid ${C.borderL}44` : "none" }}>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, color: C.white, background: barColor, padding: "1px 6px", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        {isRealAddr(addr)
                          ? <a href={explorerUrl(addr)} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: barColor, textDecoration: "none", borderBottom: `1px dashed ${barColor}44`, flex: 1 }}>{shortAddr(addr)}</a>
                          : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted, flex: 1 }}>{addr}</span>
                        }
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: barColor, flexShrink: 0 }}>{fmt(count)}</span>
                      </div>
                    );
                  })
              }
            </div>

            {report.insight && (
              <div style={{ padding: "14px 20px" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 8 }}>WEEKLY INSIGHT</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.text, lineHeight: 1.9, background: C.bg, border: `1px solid ${C.borderL}`, padding: "12px 14px" }}>
                  {report.insight}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── API Access modal ──────────────────────────────────────────
function ApiAccessModal({ onClose, isMobile }) {
  const [copied, setCopied]       = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(null);

  const copyWallet = () => {
    navigator.clipboard.writeText(SERVICE_WALLET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const BASE = API;
  const W    = "YOUR_WALLET_ADDRESS";

  const GATE = "0xd0aEAD5b90eD18bBe830cDA38789B60F4abbab4D";

  const endpoints = [
    { method: "GET",  url: `${BASE}/api/intelligence/network?wallet=${W}&mode=prepay`,  desc: "Network health snapshot" },
    { method: "GET",  url: `${BASE}/api/intelligence/contract/0xCONTRACT?wallet=${W}`,  desc: "Contract risk score" },
    { method: "GET",  url: `${BASE}/api/intelligence/block/BLOCK_NUMBER?wallet=${W}`,   desc: "Block analysis" },
    { method: "GET",  url: `${BASE}/api/intelligence/usage?wallet=${W}`,                desc: "Your usage stats" },
    { method: "GET",  url: `${BASE}/reports/weekly`,                                    desc: "Latest weekly intelligence report" },
    { method: "GET",  url: `${BASE}/api/contract`,                                      desc: "ArcSenseGate contract info, ABI + query types" },
    { method: "POST", url: `${BASE}/api/intelligence/confirm/QUERY_ID`,                 desc: "Legacy confirm · Body: { wallet, txId }" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", background: "rgba(22,23,25,0.6)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, width: isMobile ? "100%" : 600, maxHeight: isMobile ? "90dvh" : "85vh", overflowY: "auto", position: "relative", animation: isMobile ? "slideUp 0.3s ease" : "fadeIn 0.2s ease" }}>
        <Corners color={C.navy} size={16} />
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: C.charcoal }}>API ACCESS</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, marginTop: 2 }}>pay-per-query intelligence on Arc</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.borderL}`, color: C.muted, cursor: "pointer", fontSize: 12, padding: "3px 9px", fontFamily: "'Space Grotesk', sans-serif" }}>✕</button>
        </div>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderL}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "FREE TIER",     value: "5 queries", sub: "per wallet",      color: C.green    },
            { label: "PRICE / QUERY", value: "0.1 USDC",  sub: "after free tier", color: C.navy     },
            { label: "NETWORK",       value: "Arc",        sub: "EVM compatible",  color: C.charcoal },
          ].map(s => (
            <div key={s.label} style={{ background: C.bg, border: `1px solid ${C.borderL}`, padding: "10px 12px" }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL }}>{s.label}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: s.color, marginTop: 2 }}>{s.value}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderL}` }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 8 }}>PAYMENT DESTINATIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL, marginBottom: 4 }}>ARCSENSEGATE CONTRACT (RECOMMENDED)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${C.borderL}`, padding: "10px 12px" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.navy, fontWeight: 700, flex: 1, wordBreak: "break-all" }}>{GATE}</span>
                <button onClick={() => copyUrl(GATE)} style={{ background: copiedUrl === GATE ? C.green : C.navy, border: "none", color: C.white, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 9, letterSpacing: 2, padding: "5px 12px", flexShrink: 0, transition: "all 0.2s" }}>
                  {copiedUrl === GATE ? "✓ COPIED" : "COPY"}
                </button>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL, marginBottom: 4 }}>LEGACY SERVICE WALLET</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${C.borderL}`, padding: "10px 12px" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.navy, fontWeight: 700, flex: 1, wordBreak: "break-all" }}>{SERVICE_WALLET}</span>
                <button onClick={copyWallet} style={{ background: copied ? C.green : C.navy, border: "none", color: C.white, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 9, letterSpacing: 2, padding: "5px 12px", flexShrink: 0, transition: "all 0.2s" }}>
                  {copied ? "✓ COPIED" : "COPY"}
                </button>
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, marginTop: 6 }}>
            Contract path: credits added automatically on-chain. Legacy path: manual confirm required.
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderL}` }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 8 }}>ENDPOINTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {endpoints.map((e, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.borderL}`, padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1, color: e.method === "POST" ? C.amber : C.green, flexShrink: 0, marginTop: 1 }}>{e.method}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.navy, wordBreak: "break-all", lineHeight: 1.5 }}>{e.url}</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, color: C.mutedL, marginTop: 2 }}>{e.desc}</div>
                  </div>
                  <button onClick={() => copyUrl(e.url)} style={{ background: copiedUrl === e.url ? C.green : "none", border: `1px solid ${copiedUrl === e.url ? C.green : C.borderL}`, color: copiedUrl === e.url ? C.white : C.muted, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 1, padding: "3px 8px", flexShrink: 0, transition: "all 0.2s" }}>
                    {copiedUrl === e.url ? "✓" : "COPY"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, marginTop: 8 }}>
            Replace <span style={{ color: C.navy }}>YOUR_WALLET_ADDRESS</span> with your actual wallet address
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderL}` }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 4 }}>HOW TO PAY — CONTRACT PATH</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.green, marginBottom: 10 }}>✓ RECOMMENDED · credits added automatically</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { n: "1", text: `Call purchaseNative(queryType) on the ArcSenseGate contract with 0.1 USDC native value` },
              { n: "2", text: `Or call purchaseERC20(queryType) — approve the contract for 100000 USDC (6 decimals) first` },
              { n: "3", text: `Contract emits QueryPurchased event — engine detects it and credits your wallet automatically` },
              { n: "4", text: `queryType: 0=NETWORK  1=CONTRACT_RISK  2=BLOCK  3=USAGE  4=WEEKLY` },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: C.white, background: C.green, padding: "1px 7px", flexShrink: 0 }}>{s.n}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.text, lineHeight: 1.6 }}>{s.text}</span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 4, marginTop: 14 }}>HOW TO PAY — LEGACY PATH</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL, marginBottom: 10 }}>manual confirm required</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { n: "1", text: `Send 0.1 USDC to the service wallet above on Arc` },
              { n: "2", text: `Copy your transaction hash (starts with 0x)` },
              { n: "3", text: `Call POST /api/intelligence/confirm/:queryId` },
              { n: "4", text: `Body: { "wallet": "0xYOURS", "txId": "0xTX_HASH" }` },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, fontWeight: 700, color: C.white, background: C.navy, padding: "1px 7px", flexShrink: 0 }}>{s.n}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.text, lineHeight: 1.6 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "14px 20px" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 8 }}>SELECTIVE QUERIES</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.text, lineHeight: 2, background: C.bg, border: `1px solid ${C.borderL}`, padding: "10px 12px" }}>
            <div style={{ color: C.mutedL }}># Contract risk only</div>
            <div style={{ color: C.navy, wordBreak: "break-all" }}>{BASE}/api/intelligence/contract/0xABC?wallet=YOUR_WALLET_ADDRESS</div>
            <div style={{ color: C.mutedL, marginTop: 6 }}># Network health only</div>
            <div style={{ color: C.navy, wordBreak: "break-all" }}>{BASE}/api/intelligence/network?wallet=YOUR_WALLET_ADDRESS</div>
            <div style={{ color: C.mutedL, marginTop: 6 }}># Specific block only</div>
            <div style={{ color: C.navy, wordBreak: "break-all" }}>{BASE}/api/intelligence/block/BLOCK_NUMBER?wallet=YOUR_WALLET_ADDRESS</div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, marginTop: 8 }}>
            Each endpoint is independently gated. Pay only for what you query.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LANDING PAGE ──────────────────────────────────────────────
function LandingPage({ onLaunch }) {
  const [liveStats, setLiveStats]   = useState(null);
  const [agentStats, setAgentStats] = useState(null);
  const [launching, setLaunching]   = useState(false);
  const isMobile                    = useIsMobile();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [reportsRes, agentRes] = await Promise.all([
          fetch(`${API}/reports`),
          fetch(`${API}/agent/status`),
        ]);
        const reports = await reportsRes.json();
        const agent   = await agentRes.json();
        setLiveStats(reports.meta || {});
        setAgentStats(agent);
      } catch (err) {
        console.error("Failed to fetch landing stats:", err);
      }
    };
    fetchStats();
    const iv = setInterval(fetchStats, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleLaunch = () => {
    setLaunching(true);
    setTimeout(() => {
      sessionStorage.setItem("arcsense_launched", "true");
      onLaunch();
    }, 600);
  };

  const features = [
    { icon: "⛓️", title: "Live Block Intelligence", desc: "Scans every Arc block in real time. Detects failed transactions, identifies problematic contracts, and classifies failure behavior across the network.", color: C.navy,  bg: C.navyG  },
    { icon: "💳", title: "Pay-Per-Query API", desc: "5 free queries per wallet. Then 0.1 USDC per query — paid from any EVM wallet. Verified on-chain via Arc Explorer. No Circle account required.", color: C.green, bg: C.greenG },
    { icon: "⚡", title: "Autonomous Agent", desc: "An on-chain agent that monitors Arc every 5 minutes, makes autonomous decisions, and pays for intelligence using USDC from its own Circle wallet.", color: C.amber, bg: C.amberG },
  ];

  const steps = [
    { n: "01", title: "Query the API",    desc: "Send a request with your wallet address. First 5 queries are free." },
    { n: "02", title: "Pay in USDC",      desc: "After free tier, send 0.1 USDC to the service wallet from any EVM wallet on Arc." },
    { n: "03", title: "Get Intelligence", desc: "Payment verified on-chain via Blockscout. Intelligence returned immediately." },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", display: "flex", flexDirection: "column", opacity: launching ? 0 : 1, transition: "opacity 0.6s ease", overflow: "auto" }}>

      {/* NAV — Arc gradient, logo doubles as launch */}
      <div style={{ backgroundImage: C.arcGrad, padding: isMobile ? "0 20px" : "0 48px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GatewayMark size={30} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: "#F4F5F7", lineHeight: 1 }}>ArcSense</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6, letterSpacing: 2, color: "rgba(244,245,247,0.5)" }}>INTELLIGENCE · ARC</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="https://github.com/2TheMoom/arcsense-lite" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 2, color: "rgba(244,245,247,0.7)", textDecoration: "none", padding: "6px 12px", border: "1px solid rgba(244,245,247,0.25)", display: isMobile ? "none" : "block" }}
          >GITHUB</a>
          <button onClick={handleLaunch} style={{ background: "#F4F5F7", border: "none", color: C.arc1, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, padding: isMobile ? "8px 16px" : "9px 20px", transition: "all 0.2s" }}
          >LAUNCH DASHBOARD →</button>
        </div>
      </div>

      {/* HERO */}
      <div style={{ padding: isMobile ? "60px 24px 40px" : "100px 48px 60px", textAlign: "center", maxWidth: 860, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.border}`, padding: "5px 14px", marginBottom: 28 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "blink 1.8s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: 3, color: C.green, fontWeight: 700 }}>LIVE ON ARC</span>
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isMobile ? 34 : 52, lineHeight: 1.15, color: C.charcoal, marginBottom: 20 }}>
          Real-time intelligence<br /><span style={{ color: C.navy }}>infrastructure for Arc</span>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: isMobile ? 11 : 13, color: C.muted, lineHeight: 1.9, maxWidth: 620, margin: "0 auto 36px", letterSpacing: 0.3 }}>
          ArcSense scans every Arc block live, surfaces failing contracts, and exposes gated intelligence through a pay-per-query API — consumed by developers, wallets, and autonomous agents.
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={handleLaunch} style={{ background: C.navy, border: "none", color: "#fff", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, padding: "14px 32px", transition: "all 0.2s" }}
          >▶ LAUNCH DASHBOARD</button>
          <a href="https://github.com/2TheMoom/arcsense-lite" target="_blank" rel="noopener noreferrer"
            style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, padding: "14px 32px", textDecoration: "none", display: "inline-block" }}
          >VIEW GITHUB</a>
        </div>
      </div>

      {/* LIVE STATS BAR */}
      <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "20px 24px" : "20px 48px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 16 : 0 }}>
          {[
            { label: "BLOCKS SCANNED",   value: liveStats?.totalBlocksScanned   ? liveStats.totalBlocksScanned.toLocaleString()     : "—", color: C.navy    },
            { label: "ALERTS TRIGGERED", value: liveStats?.totalAlertsTriggered ? liveStats.totalAlertsTriggered.toLocaleString()    : "—", color: C.crimson },
            { label: "AGENT CYCLES",     value: agentStats?.totalCycles         ? agentStats.totalCycles.toLocaleString()            : "—", color: C.green   },
            { label: "USDC SPENT",       value: agentStats?.totalUsdcSpent      ? `$${agentStats.totalUsdcSpent.toFixed(2)}`         : "—", color: C.green   },
          ].map((s, i) => (
            <div key={s.label} style={{ textAlign: "center", borderRight: !isMobile && i < 3 ? `1px solid ${C.border}` : "none", padding: "0 24px" }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ padding: isMobile ? "48px 24px" : "72px 48px", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: 4, color: C.mutedL, textAlign: "center", marginBottom: 8 }}>WHAT ARCSENSE DOES</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isMobile ? 24 : 30, color: C.charcoal, textAlign: "center", marginBottom: 40 }}>Everything you need for Arc intelligence</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 16 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "28px 24px", position: "relative" }}>
              <Corners color={f.color} size={12} />
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: C.charcoal, marginBottom: 10 }}>{f.title}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted, lineHeight: 1.9 }}>{f.desc}</div>
              <div style={{ position: "absolute", top: 20, right: 20, background: f.bg, border: `1px solid ${f.color}44`, padding: "2px 8px" }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: f.color, animation: "blink 2s ease-in-out infinite", display: "inline-block", marginRight: 4, verticalAlign: "middle" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: 2, color: f.color, fontWeight: 700, verticalAlign: "middle" }}>LIVE</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "48px 24px" : "72px 48px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: 4, color: C.mutedL, textAlign: "center", marginBottom: 8 }}>HOW IT WORKS</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isMobile ? 24 : 30, color: C.charcoal, textAlign: "center", marginBottom: 48 }}>Three steps to intelligence</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 24 }}>
            {steps.map(s => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 40, color: C.border, lineHeight: 1, marginBottom: 12 }}>{s.n}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: C.charcoal, marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted, lineHeight: 1.9 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BUILT WITH */}
      <div style={{ padding: isMobile ? "40px 24px" : "60px 48px", maxWidth: 960, margin: "0 auto", width: "100%", textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: 4, color: C.mutedL, marginBottom: 24 }}>BUILT WITH</div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          {[
            { label: "Arc Network",  sub: "Layer 1 blockchain"     },
            { label: "Circle USDC",  sub: "Programmable payments"  },
            { label: "Blockscout",   sub: "On-chain verification"  },
            { label: "Railway",      sub: "Engine hosting"         },
          ].map(b => (
            <div key={b.label} style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "12px 20px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: C.charcoal }}>{b.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, color: C.mutedL, marginTop: 2 }}>{b.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA BANNER — Arc gradient */}
      <div style={{ backgroundImage: C.arcGrad, padding: isMobile ? "40px 24px" : "60px 48px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: isMobile ? 24 : 32, color: "#F4F5F7", marginBottom: 12 }}>Start exploring Arc intelligence</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(244,245,247,0.6)", marginBottom: 28 }}>Live on Arc · 5 free queries per wallet</div>
        <button onClick={handleLaunch} style={{ background: "#F4F5F7", border: "none", color: C.arc1, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, padding: "14px 36px", transition: "all 0.2s" }}
        >▶ LAUNCH DASHBOARD</button>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: isMobile ? "18px 24px" : "18px 48px", display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: "center", gap: 10, background: C.panel, textAlign: isMobile ? "center" : "left" }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: C.muted }}>
          Built by{" "}<a href="https://x.com/olumi441" target="_blank" rel="noopener noreferrer" style={{ color: C.navy, fontWeight: 700, textDecoration: "none" }}>Abu Olumi</a>
        </span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: C.muted }}>
          Powered by{" "}<a href="https://x.com/arc" target="_blank" rel="noopener noreferrer" style={{ color: C.navy, fontWeight: 700, textDecoration: "none" }}>Arc</a>
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 2, color: C.mutedL }}>Arc Hackathon 2026 · Track 4</span>
      </div>
    </div>
  );
}

// ── Mobile signal bar ─────────────────────────────────────────
function MobileSignalBar({ trend, insight }) {
  const trendColor = trend.includes("RISING") ? C.crimson : trend.includes("DROP") ? C.navyL : C.muted;
  return (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", flexShrink: 0 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL, marginBottom: 4 }}>TREND · INSIGHT</div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: trendColor, fontWeight: 700, whiteSpace: "nowrap" }}>{trend}</span>
        <span style={{ color: C.borderL }}>·</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted, lineHeight: 1.5 }}>{insight}</span>
      </div>
    </div>
  );
}

// ── Top bar — logo doubles as the home button ───────────────────
function TopBar({ trend, severity, insight, latestBlock, isMobile, onApiAccess, onWeeklyReport, onBackToLanding }) {
  const sevColor   = severity === "HIGH" ? C.crimson : severity === "MEDIUM" ? C.amber : C.navy;
  const sevBg      = severity === "HIGH" ? C.crimsonG : severity === "MEDIUM" ? C.amberG : C.navyG;

  if (isMobile) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 54, backgroundImage: C.arcGrad, flexShrink: 0 }}>
        <div onClick={onBackToLanding} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <GatewayMark size={26} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: "#F4F5F7", lineHeight: 1 }}>ArcSense</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6, letterSpacing: 1, color: "rgba(244,245,247,0.5)" }}>ARC TESTNET</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={onWeeklyReport} style={{ background: "rgba(244,245,247,0.1)", border: "1px solid rgba(244,245,247,0.25)", color: "#F4F5F7", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 1, fontWeight: 700, padding: "4px 8px" }}>📅</button>
          <button onClick={onApiAccess} style={{ background: "rgba(244,245,247,0.1)", border: "1px solid rgba(244,245,247,0.25)", color: "#F4F5F7", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 2, fontWeight: 700, padding: "4px 10px" }}>API</button>
          <div style={{ background: sevBg, border: `1px solid ${sevColor}44`, padding: "4px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 7, letterSpacing: 2, color: C.mutedL }}>SEV</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, color: sevColor, letterSpacing: 2 }}>{severity}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid rgba(244,245,247,0.3)", padding: "4px 7px", background: "rgba(244,245,247,0.1)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F4F5F7", animation: "blink 1.8s ease-in-out infinite" }} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 2, color: "#F4F5F7", fontWeight: 600 }}>LIVE</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 62, backgroundImage: C.arcGrad, flexShrink: 0 }}>
      <div onClick={onBackToLanding} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <GatewayMark size={34} />
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19, color: "#F4F5F7", lineHeight: 1 }}>ArcSense</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: 2, color: "rgba(244,245,247,0.5)" }}>TESTNET INTELLIGENCE · ARC NETWORK</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "stretch", border: "1px solid rgba(244,245,247,0.2)" }}>
        {[
          { label: "TREND",    value: trend,    color: "#F4F5F7" },
          { label: "INSIGHT",  value: insight,  color: "rgba(244,245,247,0.85)", small: true },
          { label: "SEVERITY", value: severity, color: sevColor === C.navy ? "#F4F5F7" : sevColor, bold: true, bg: "rgba(244,245,247,0.08)" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "8px 20px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(244,245,247,0.2)" : "none", background: s.bg || "transparent" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 8, letterSpacing: 3, color: "rgba(244,245,247,0.5)", marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: s.bold ? "'Space Grotesk', sans-serif" : "'JetBrains Mono', monospace", fontSize: s.small ? 9 : s.bold ? 16 : 10, fontWeight: s.bold ? 700 : 400, color: s.color, letterSpacing: s.bold ? 4 : 0, maxWidth: s.small ? 240 : "auto" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onWeeklyReport} style={{ background: "rgba(244,245,247,0.1)", border: "1px solid rgba(244,245,247,0.3)", color: "#F4F5F7", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 9, letterSpacing: 3, fontWeight: 700, padding: "6px 14px", transition: "all 0.2s" }}
        >📅 WEEKLY</button>
        <button onClick={onApiAccess} style={{ background: "rgba(244,245,247,0.1)", border: "1px solid rgba(244,245,247,0.3)", color: "#F4F5F7", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 9, letterSpacing: 3, fontWeight: 700, padding: "6px 14px", transition: "all 0.2s" }}
        >⚡ API ACCESS</button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(244,245,247,0.3)", padding: "5px 12px", background: "rgba(244,245,247,0.1)" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F4F5F7", animation: "blink 1.8s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, letterSpacing: 3, color: "#F4F5F7", fontWeight: 600 }}>LIVE</span>
        </div>
        {latestBlock && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(244,245,247,0.6)" }}>#{latestBlock.toLocaleString()}</span>}
      </div>
    </div>
  );
}

// ── Alert toast ───────────────────────────────────────────────
function AlertToast({ alert, onDismiss, isMobile }) {
  const isCrit = alert.failureRate >= 0.15;
  const accent = isCrit ? C.crimson : C.amber;
  const bg     = isCrit ? "#FFF5F5" : "#FFFBF0";
  return (
    <div style={{ position: "fixed", top: isMobile ? "auto" : 74, bottom: isMobile ? 16 : "auto", right: isMobile ? 12 : 24, left: isMobile ? 12 : "auto", zIndex: 999, background: bg, borderLeft: `5px solid ${accent}`, border: `1px solid ${accent}`, borderRadius: 1, padding: "16px 18px", maxWidth: isMobile ? "100%" : 390, boxShadow: `0 12px 50px ${accent}33, 0 4px 16px rgba(0,0,0,0.1)`, animation: "alertIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 1, color: accent, display: "block" }}>{isCrit ? "⛔  CRITICAL ALERT" : "⚠️  WARNING ALERT"}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, letterSpacing: 1 }}>{new Date().toLocaleTimeString()}</span>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: `1px solid ${C.borderL}`, color: C.muted, cursor: "pointer", fontSize: 11, padding: "2px 7px", borderRadius: 1, marginLeft: 12 }}>✕</button>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.text, marginBottom: 12, lineHeight: 1.8 }}>
        {isCrit ? "Severe" : "Abnormal"} failure spike —{" "}
        <span style={{ color: accent, fontWeight: 700, fontSize: 13 }}>{(alert.failureRate * 100).toFixed(0)}%</span>{" "}of transactions failed
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.muted, lineHeight: 2.2, borderTop: `1px solid ${accent}33`, paddingTop: 10, letterSpacing: 1 }}>
        <div>BLOCK · #{alert.blockNumber?.toLocaleString()}</div>
        <div>FAILED · {alert.failedTx} of {alert.totalTx} tx</div>
        {alert.topContract && isRealAddr(alert.topContract)
          ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span>CONTRACT ·</span><a href={explorerUrl(alert.topContract)} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none", borderBottom: `1px dashed ${accent}` }}>{shortAddr(alert.topContract)}</a></div>
          : alert.topContract ? <div>CONTRACT · unknown</div> : null
        }
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────
function Footer({ isMobile }) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: isMobile ? "18px 20px" : "14px 32px", display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: isMobile ? "center" : "space-between", alignItems: "center", gap: isMobile ? 10 : 0, background: C.panel, flexShrink: 0, textAlign: isMobile ? "center" : "left" }}>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: C.muted }}>
        Powered by{" "}<a href="https://x.com/arc" target="_blank" rel="noopener noreferrer" style={{ color: C.navy, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>Arc</a>
      </span>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: C.muted }}>
        Built by{" "}<a href="https://x.com/olumi441" target="_blank" rel="noopener noreferrer" style={{ color: C.navy, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>Abu Olumi</a>
      </span>
      {!isMobile && <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, letterSpacing: 2, color: C.mutedL }}>Real-time signal intelligence for Arc</span>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function ArcSenseDashboard() {
  const [showLanding, setShowLanding]         = useState(() => sessionStorage.getItem("arcsense_launched") !== "true");
  const [blocks, setBlocks]                   = useState([]);
  const [alert, setAlert]                     = useState(null);
  const [meta, setMeta]                       = useState({ totalBlocksScanned: 0, totalAlertsTriggered: 0 });
  const [selectedContract, setSelected]       = useState(null);
  const [agentStatus, setAgentStatus]         = useState(null);
  const [agentLog, setAgentLog]               = useState([]);
  const [triggering, setTriggering]           = useState(false);
  const [showApiModal, setShowApiModal]       = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const alertedBlocks                         = useRef(new Set());
  const isMobile                              = useIsMobile();

  const handleBackToLanding = () => {
    sessionStorage.removeItem("arcsense_launched");
    setShowLanding(true);
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res  = await fetch(`${API}/reports`);
        const json = await res.json();
        const data = Array.isArray(json) ? json : (json.reports || []);
        if (json.meta) setMeta(json.meta);
        const mapped = data.map((r) => ({
          blockNumber: r.blockNumber,
          totalTx:     r.totalTx,
          failedTx:    r.failedTx,
          failureRate: r.failureRate,
          topFailing:  r.topFailingContracts || {},
        }));
        setBlocks(mapped);
        const latest = mapped[mapped.length - 1];
        if (latest && latest.failureRate >= 0.10 && !alertedBlocks.current.has(latest.blockNumber)) {
          alertedBlocks.current.add(latest.blockNumber);
          const top = Object.entries(latest.topFailing).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
          setAlert({ ...latest, topContract: top });
          setTimeout(() => setAlert(null), 8000);
        }
      } catch (err) {
        console.error("Failed to fetch reports:", err);
      }
    };
    fetchReports();
    const iv = setInterval(fetchReports, 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const [statusRes, logRes] = await Promise.all([
          fetch(`${API}/agent/status`),
          fetch(`${API}/agent/log?limit=10`),
        ]);
        setAgentStatus(await statusRes.json());
        setAgentLog((await logRes.json()).decisions || []);
      } catch (err) {
        console.error("Failed to fetch agent data:", err);
      }
    };
    fetchAgent();
    const iv = setInterval(fetchAgent, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleTrigger = async () => {
    if (triggering) return;
    setTriggering(true);
    try {
      await fetch(`${API}/agent/run`, { method: "POST" });
      await new Promise(r => setTimeout(r, 2000));
      const [statusRes, logRes] = await Promise.all([
        fetch(`${API}/agent/status`),
        fetch(`${API}/agent/log?limit=10`),
      ]);
      setAgentStatus(await statusRes.json());
      setAgentLog((await logRes.json()).decisions || []);
    } catch (err) {
      console.error("Failed to trigger agent:", err);
    } finally {
      setTriggering(false);
    }
  };

  const latest   = blocks[blocks.length - 1];
  const trend    = getTrend(blocks);
  const severity = latest ? latest.failureRate >= 0.15 ? "HIGH" : latest.failureRate >= 0.10 ? "MEDIUM" : "LOW" : "LOW";
  const insight  = latest
    ? latest.failureRate >= 0.15 ? "Elevated failure rate detected across multiple transactions."
    : latest.failureRate >= 0.10 ? "Moderate failure activity detected."
    : "Network operating within normal parameters."
    : "Awaiting data...";

  const contractHistory = buildContractHistory(blocks);
  const selectedData    = selectedContract ? contractHistory[selectedContract] : null;
  const selectedClass   = selectedData ? classifyContract(selectedContract, selectedData.total, selectedData.blocks.length, blocks.length, selectedData.firstIdx, selectedData.lastIdx) : null;

  if (showLanding) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body, #root { height: 100%; }
          body { overflow-x: hidden; }
          ::-webkit-scrollbar { width: 3px; }
          ::-webkit-scrollbar-track { background: ${C.bgDeep}; }
          ::-webkit-scrollbar-thumb { background: ${C.border}; }
          @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.25} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
        <LandingPage onLaunch={() => setShowLanding(false)} />
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { overflow-x: hidden; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: ${C.bgDeep}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes fadeIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes alertIn  { from{transform:translateX(40px) scale(0.95);opacity:0} to{transform:translateX(0) scale(1);opacity:1} }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {isMobile ? (
        <div style={{ background: C.bg, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
          <TopBar trend={trend} severity={severity} insight={insight} latestBlock={latest?.blockNumber} isMobile={true} onApiAccess={() => setShowApiModal(true)} onWeeklyReport={() => setShowWeeklyModal(true)} onBackToLanding={handleBackToLanding} />
          <MobileSignalBar trend={trend} insight={insight} />
          <div style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: 12 }}>
            {selectedContract && selectedClass && <FilterBadge addr={selectedContract} classification={selectedClass} onClear={() => setSelected(null)} />}
            {selectedContract
              ? <ScopedStatsRow blocks={blocks} selectedContract={selectedContract} isMobile={true} />
              : <StatsRow blocks={blocks} isMobile={true} meta={meta} agentStatus={agentStatus} />
            }
            <BlockFeed blocks={blocks} isMobile={true} selectedContract={selectedContract} />
            <NetworkPulse blocks={blocks} isMobile={true} selectedContract={selectedContract} />
            <ContractsPanel blocks={blocks} isMobile={true} selectedContract={selectedContract} onSelectContract={setSelected} />
            <AgentPanel agentStatus={agentStatus} agentLog={agentLog} isMobile={true} onTrigger={handleTrigger} triggering={triggering} />
          </div>
          <Footer isMobile={true} />
        </div>
      ) : (
        <div style={{ background: C.bg, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TopBar trend={trend} severity={severity} insight={insight} latestBlock={latest?.blockNumber} isMobile={false} onApiAccess={() => setShowApiModal(true)} onWeeklyReport={() => setShowWeeklyModal(true)} onBackToLanding={handleBackToLanding} />
          <div style={{ flex: 1, padding: "14px 24px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", minHeight: 0 }}>
            {selectedContract && selectedClass && <FilterBadge addr={selectedContract} classification={selectedClass} onClear={() => setSelected(null)} />}
            {selectedContract
              ? <ScopedStatsRow blocks={blocks} selectedContract={selectedContract} isMobile={false} />
              : <StatsRow blocks={blocks} isMobile={false} meta={meta} agentStatus={agentStatus} />
            }
            <div style={{ display: "grid", gridTemplateColumns: "230px 200px 1fr 230px", gap: 12, flex: 1, minHeight: 0, overflow: "hidden" }}>
              <BlockFeed blocks={blocks} isMobile={false} selectedContract={selectedContract} />
              <NetworkPulse blocks={blocks} isMobile={false} selectedContract={selectedContract} />
              <ContractsPanel blocks={blocks} isMobile={false} selectedContract={selectedContract} onSelectContract={setSelected} />
              <AgentPanel agentStatus={agentStatus} agentLog={agentLog} isMobile={false} onTrigger={handleTrigger} triggering={triggering} />
            </div>
          </div>
          <Footer isMobile={false} />
        </div>
      )}

      {alert && <AlertToast alert={alert} onDismiss={() => setAlert(null)} isMobile={isMobile} />}
      {showApiModal    && <ApiAccessModal      onClose={() => setShowApiModal(false)}    isMobile={isMobile} />}
      {showWeeklyModal && <WeeklyReportsModal  onClose={() => setShowWeeklyModal(false)} isMobile={isMobile} />}
    </>
  );
}