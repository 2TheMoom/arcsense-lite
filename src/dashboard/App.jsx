import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

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
  navy:    "#1F3A8F",
  navyL:   "#2B4DB0",
  navyDark:"#0D1F54",
  navyG:   "rgba(31,58,143,0.07)",
  crimson: "#B01C2E",
  amber:   "#8A6010",
  white:   "#FAFAF8",
};

// ── Arc official logo — arch/gateway mark ─────────────────────
function ArcLogo({ height = 22 }) {
  // Faithful SVG recreation of the Arc arch mark on its navy pill background
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: `linear-gradient(160deg, #1a3a7a 0%, #0D1F54 100%)`,
      borderRadius: 6, padding: "4px 10px", gap: 7,
    }}>
      {/* Arch SVG — matches Arc's gateway letterform */}
      <svg width="16" height="20" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer arch */}
        <path
          d="M16 2C8.268 2 2 8.6 2 16.8 L2 36 L8.5 36 L8.5 17C8.5 12.029 11.81 8 16 8 C20.19 8 23.5 12.029 23.5 17 L23.5 36 L30 36 L30 16.8 C30 8.6 23.732 2 16 2Z"
          fill="url(#arcGrad)"
        />
        {/* Inner cutout arch — creates the hollow gateway shape */}
        <path
          d="M16 11C13.2 11 11 13.8 11 17.2 L11 36 L14.5 36 L14.5 17.5 C14.5 15.6 15.1 14.2 16 14.2 C16.9 14.2 17.5 15.6 17.5 17.5 L17.5 36 L21 36 L21 17.2 C21 13.8 18.8 11 16 11Z"
          fill={`#0D1F54`}
        />
        <defs>
          <linearGradient id="arcGrad" x1="2" y1="2" x2="30" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#B8C8E8" />
            <stop offset="50%" stopColor="#D8E4F4" />
            <stop offset="100%" stopColor="#8AAAD0" />
          </linearGradient>
        </defs>
      </svg>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700, fontSize: 13, letterSpacing: 1.5,
        color: "#D8E4F4",
      }}>Arc</span>
    </div>
  );
}

// ── ArcSense logo mark ────────────────────────────────────────
function ArcSenseLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="16" stroke={C.charcoal} strokeWidth="1.5" strokeDasharray="80 25" strokeLinecap="round" />
      <circle cx="18" cy="18" r="11" stroke={C.navy} strokeWidth="1.5" strokeDasharray="52 18" strokeLinecap="round" />
      <rect x="14.5" y="14.5" width="7" height="7" transform="rotate(45 18 18)" fill={C.navy} />
      <circle cx="30" cy="6" r="2.5" fill={C.navy} />
      <line x1="2" y1="18" x2="6" y2="18" stroke={C.charcoal} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="30" y1="18" x2="34" y2="18" stroke={C.charcoal} strokeWidth="1.2" strokeLinecap="round" />
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
        <div style={{
          position: "absolute", top: -9, left: 14,
          background: C.bg, padding: "0 8px",
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 8, letterSpacing: 3, color: accent, fontWeight: 600,
        }}>{label}</div>
      )}
      {children}
    </div>
  );
}

// ── Simulated data ────────────────────────────────────────────
function generateBlock(prev) {
  const blockNumber = prev ? prev.blockNumber + 1 : 40733860;
  const totalTx = Math.floor(Math.random() * 22) + 3;
  const failedTx = Math.random() < 0.22 ? Math.floor(Math.random() * Math.max(1, totalTx * 0.3)) : 0;
  const failureRate = totalTx === 0 ? 0 : failedTx / totalTx;
  const contracts = ["0x96De58F6...3a490","0xFF5Cb292...E8d1","0x2D84D79C...d457","0xfAbC9FA9...cB4","unknown"];
  const topFailing = {};
  for (let i = 0; i < failedTx; i++) {
    const addr = contracts[Math.floor(Math.random() * contracts.length)];
    topFailing[addr] = (topFailing[addr] || 0) + 1;
  }
  return { blockNumber, totalTx, failedTx, failureRate, topFailing };
}

function getTrend(history) {
  if (history.length < 4) return "INSUFFICIENT DATA";
  const recent = history.slice(-5).map(b => b.failureRate);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prev = history.slice(-10, -5).map(b => b.failureRate);
  const prevAvg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : avg;
  if (avg > prevAvg + 0.02) return "FAILURE RATE RISING";
  if (avg < prevAvg - 0.02) return "FAILURE RATE DROPPING";
  return "STABLE ACTIVITY";
}

// ── Top bar ───────────────────────────────────────────────────
function TopBar({ trend, severity, insight, latestBlock }) {
  const sevColor = severity === "HIGH" ? C.crimson : severity === "MEDIUM" ? C.amber : C.navy;
  const trendColor = trend.includes("RISING") ? C.crimson : trend.includes("DROP") ? C.navyL : C.muted;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", height: 62, borderBottom: `1px solid ${C.border}`,
      background: C.panel, flexShrink: 0,
    }}>
      {/* Logo + Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ArcSenseLogo size={36} />
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 5, color: C.charcoal, lineHeight: 1 }}>ARCSENSE</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: 2, color: C.mutedL }}>TESTNET INTELLIGENCE · ARC NETWORK</div>
        </div>
      </div>

      {/* Signal Summary */}
      <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${C.border}` }}>
        {[
          { label: "TREND",    value: trend,    color: trendColor },
          { label: "INSIGHT",  value: insight,  color: C.text, small: true },
          { label: "SEVERITY", value: severity, color: sevColor, bold: true },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "8px 20px", textAlign: "center",
            borderRight: i < 2 ? `1px solid ${C.border}` : "none",
            background: i === 2 && severity !== "LOW" ? `${sevColor}09` : "transparent",
          }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 5 }}>{s.label}</div>
            <div style={{
              fontFamily: s.bold ? "'Barlow Condensed', sans-serif" : "'JetBrains Mono', monospace",
              fontSize: s.small ? 9 : s.bold ? 16 : 10,
              fontWeight: s.bold ? 700 : 400,
              color: s.color,
              letterSpacing: s.bold ? 4 : 0,
              maxWidth: s.small ? 240 : "auto",
            }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Live badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${C.navy}44`, padding: "5px 12px", background: C.navyG }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.navy, animation: "blink 1.8s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: 3, color: C.navy, fontWeight: 600 }}>LIVE</span>
        </div>
        {latestBlock && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL }}>#{latestBlock.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────
function StatsRow({ blocks }) {
  const total  = blocks.reduce((s, b) => s + b.totalTx, 0);
  const failed = blocks.reduce((s, b) => s + b.failedTx, 0);
  const avgRate = blocks.length ? (blocks.reduce((s, b) => s + b.failureRate, 0) / blocks.length * 100).toFixed(2) : "0.00";
  const alerts  = blocks.filter(b => b.failureRate >= 0.10).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
      {[
        { label: "BLOCKS SCANNED",     value: blocks.length,          sub: "processed" },
        { label: "TOTAL TRANSACTIONS", value: total.toLocaleString(),  sub: "on-chain" },
        { label: "TOTAL FAILURES",     value: failed.toLocaleString(), sub: "detected",   color: failed > 0 ? C.crimson : C.charcoal },
        { label: "AVG FAILURE RATE",   value: `${avgRate}%`,           sub: "rolling avg", color: parseFloat(avgRate) >= 10 ? C.crimson : parseFloat(avgRate) >= 5 ? C.amber : C.charcoal },
        { label: "ALERTS TRIGGERED",   value: alerts.toString(),       sub: "≥10% spikes", color: alerts > 0 ? C.crimson : C.charcoal },
      ].map((s, i) => (
        <HudPanel key={i} accent={s.color && s.color !== C.charcoal ? s.color : C.navy} style={{ padding: "14px 18px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL, marginBottom: 8 }}>{s.label}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, color: s.color || C.charcoal, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, marginTop: 5 }}>{s.sub}</div>
        </HudPanel>
      ))}
    </div>
  );
}

// ── Block feed ────────────────────────────────────────────────
function BlockFeed({ blocks }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [blocks]);
  return (
    <HudPanel label="BLOCK FEED" style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL }}>LIVE STREAM</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{blocks.length}</span>
      </div>
      <div ref={ref} style={{ overflowY: "auto", flex: 1 }}>
        {blocks.slice(-50).map((b, i, arr) => {
          const isNew  = i === arr.length - 1;
          const isCrit = b.failureRate >= 0.15;
          const isWarn = b.failureRate >= 0.10;
          return (
            <div key={b.blockNumber} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 16px",
              borderLeft: `2px solid ${isCrit ? C.crimson : isWarn ? C.amber : C.borderL}`,
              background: isNew ? C.navyG : "transparent",
              transition: "background 0.5s",
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isNew ? C.navy : C.muted }}>
                #{b.blockNumber.toLocaleString()}
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{b.totalTx}tx</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 1, color: isCrit ? C.crimson : isWarn ? C.amber : C.navy }}>
                  {b.failedTx > 0 ? `${b.failedTx} FAIL` : "OK"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}

// ── Chart ─────────────────────────────────────────────────────
function FailureChart({ chartData }) {
  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    return (
      <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: "8px 12px" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 2, color: C.mutedL, marginBottom: 4 }}>BLOCK #{label}</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: val >= 15 ? C.crimson : val >= 10 ? C.amber : C.navy }}>
          {val.toFixed(1)}% FAILURE
        </div>
      </div>
    );
  };
  return (
    <HudPanel label="FAILURE RATE · LAST 30 BLOCKS" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ flex: 1, padding: "20px 8px 0 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
            <XAxis dataKey="block"
              tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fill: C.mutedL }}
              axisLine={{ stroke: C.borderL }} tickLine={false}
              tickFormatter={v => String(v).slice(-4)} interval="preserveStartEnd"
            />
            <YAxis tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fill: C.mutedL }}
              axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0,"auto"]} width={32}
            />
            <Tooltip content={<Tip />} />
            <ReferenceLine y={10} stroke={C.amber}  strokeDasharray="4 3" strokeWidth={1} />
            <ReferenceLine y={15} stroke={C.crimson} strokeDasharray="4 3" strokeWidth={1} />
            <Line type="monotone" dataKey="rate" stroke={C.navy} strokeWidth={1.5} dot={false}
              activeDot={{ r: 3, fill: C.navy, stroke: C.panel, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 24, padding: "10px 20px 14px", borderTop: `1px solid ${C.borderL}` }}>
        {[{ color: C.amber, label: "10% WARNING" }, { color: C.crimson, label: "15% CRITICAL" }].map(t => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, borderTop: `1px dashed ${t.color}` }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 2, color: t.color }}>{t.label}</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

// ── Contracts ─────────────────────────────────────────────────
function ContractsPanel({ blocks }) {
  const history = {};
  for (const b of blocks)
    for (const [addr, count] of Object.entries(b.topFailing || {}))
      history[addr] = (history[addr] || 0) + count;

  const sorted = Object.entries(history).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;

  return (
    <HudPanel label="CONTRACT INTELLIGENCE" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL }}>FAILURE ACCUMULATION</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{sorted.length} tracked</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sorted.length === 0
          ? <div style={{ padding: "24px 18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL }}>No failures yet.</div>
          : sorted.map(([addr, count], i) => {
            const intensity = count / max;
            const barColor = intensity > 0.7 ? C.crimson : intensity > 0.4 ? C.amber : C.navy;
            return (
              <div key={addr} style={{ padding: "10px 18px", borderBottom: `1px solid ${C.borderL}44` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, color: C.white, background: barColor, padding: "1px 6px" }}>{i + 1}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: intensity > 0.7 ? C.crimson : C.text }}>{addr}</span>
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: barColor }}>{count}</span>
                </div>
                <div style={{ height: 2, background: C.bgDeep }}>
                  <div style={{ height: "100%", width: `${intensity * 100}%`, background: barColor, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
      </div>
    </HudPanel>
  );
}

// ── Alert toast ───────────────────────────────────────────────
function AlertToast({ alert, onDismiss }) {
  const isCrit = alert.failureRate >= 0.15;
  const accent = isCrit ? C.crimson : C.amber;
  return (
    <div style={{
      position: "fixed", top: 78, right: 24, zIndex: 999,
      background: C.white, borderLeft: `4px solid ${accent}`,
      border: `1px solid ${accent}44`, borderRadius: 1,
      padding: "18px 22px", maxWidth: 370,
      boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
      animation: "slideIn 0.25s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 3, color: accent }}>
          {isCrit ? "⛔  CRITICAL ALERT" : "⚠️  WARNING ALERT"}
        </span>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: C.mutedL, cursor: "pointer", fontSize: 12, padding: 0, marginLeft: 12 }}>✕</button>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.text, marginBottom: 12, lineHeight: 1.8 }}>
        {isCrit ? "Severe" : "Abnormal"} failure spike —{" "}
        <span style={{ color: accent, fontWeight: 700 }}>{(alert.failureRate * 100).toFixed(0)}%</span> of transactions failed
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.muted, lineHeight: 2.2, borderTop: `1px solid ${C.borderL}`, paddingTop: 10, letterSpacing: 1 }}>
        <div>BLOCK · #{alert.blockNumber?.toLocaleString()}</div>
        <div>FAILED · {alert.failedTx} of {alert.totalTx} tx</div>
        {alert.topContract && <div style={{ color: accent }}>CONTRACT · {alert.topContract}</div>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function ArcSenseDashboard() {
  const [blocks, setBlocks] = useState([]);
  const [alert, setAlert]   = useState(null);

  useEffect(() => {
    const seed = []; let prev = null;
    for (let i = 0; i < 12; i++) { const b = generateBlock(prev); seed.push(b); prev = b; }
    setBlocks(seed);

    const iv = setInterval(() => {
      setBlocks(prev => {
        const last = prev[prev.length - 1];
        const nb = generateBlock(last);
        if (nb.failureRate >= 0.10) {
          const top = Object.entries(nb.topFailing).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
          setAlert({ ...nb, topContract: top });
          setTimeout(() => setAlert(null), 7000);
        }
        return [...prev, nb];
      });
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  const latest   = blocks[blocks.length - 1];
  const trend    = getTrend(blocks);
  const severity = latest ? (latest.failureRate >= 0.15 ? "HIGH" : latest.failureRate >= 0.10 ? "MEDIUM" : "LOW") : "LOW";
  const insight  = latest
    ? latest.failureRate >= 0.15 ? "Elevated failure rate detected across multiple transactions."
    : latest.failureRate >= 0.10 ? "Moderate failure activity detected."
    : "Network operating within normal parameters."
    : "Awaiting data...";
  const chartData = blocks.slice(-30).map(b => ({ block: b.blockNumber, rate: parseFloat((b.failureRate * 100).toFixed(2)) }));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: ${C.bgDeep}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes slideIn { from{transform:translateX(28px);opacity:0} to{transform:translateX(0);opacity:1} }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopBar trend={trend} severity={severity} insight={insight} latestBlock={latest?.blockNumber} />

        <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <StatsRow blocks={blocks} />
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 300px", gap: 12, flex: 1, minHeight: 0 }}>
            <BlockFeed blocks={blocks} />
            <FailureChart chartData={chartData} />
            <ContractsPanel blocks={blocks} />
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${C.border}`, padding: "11px 32px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: C.panel, flexShrink: 0,
        }}>
          {/* Left — Powered by Arc */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 1, color: C.muted }}>
              Powered by{" "}
              <a
                href="https://x.com/arc"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.navy, fontWeight: 700, textDecoration: "none", letterSpacing: 1 }}
                onMouseEnter={e => e.target.style.color = C.navyL}
                onMouseLeave={e => e.target.style.color = C.navy}
              >
                Arc
              </a>
            </span>
          </div>

          {/* Centre — Built by Abu Olumi */}
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 1, color: C.muted }}>
            Built by{" "}
            <a
              href="https://x.com/olumi441"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.navy, fontWeight: 700, textDecoration: "none", letterSpacing: 1 }}
              onMouseEnter={e => e.target.style.color = C.navyL}
              onMouseLeave={e => e.target.style.color = C.navy}
            >
              Abu Olumi
            </a>
          </span>

          {/* Right — purposeful tagline */}
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: 2, color: C.mutedL }}>
            Real-time signal intelligence for Arc Testnet
          </span>
        </div>
      </div>

      {alert && <AlertToast alert={alert} onDismiss={() => setAlert(null)} />}
    </>
  );
}