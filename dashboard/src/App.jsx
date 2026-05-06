import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

// ── Brand tokens ──────────────────────────────────────────────
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
  navyG:   "rgba(31,58,143,0.07)",
  crimson: "#B01C2E",
  crimsonG:"rgba(176,28,46,0.07)",
  amber:   "#8A6010",
  amberG:  "rgba(138,96,16,0.07)",
  white:   "#FAFAF8",
};

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

// ── Trend logic ───────────────────────────────────────────────
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

// ── Chart tooltip — defined OUTSIDE component to fix ESLint ──
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rate = payload.find(p => p.dataKey === "rate");
  const avg  = payload.find(p => p.dataKey === "avg");
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: "10px 14px", borderRadius: 1 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 2, color: C.mutedL, marginBottom: 6 }}>
        BLOCK #{label}
      </div>
      {rate && (
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: rate.value >= 15 ? C.crimson : rate.value >= 10 ? C.amber : C.navy }}>
          {rate.value.toFixed(1)}% FAILURE
        </div>
      )}
      {avg && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted, marginTop: 4 }}>
          avg {avg.value.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────
function TopBar({ trend, severity, insight, latestBlock }) {
  const sevColor   = severity === "HIGH" ? C.crimson : severity === "MEDIUM" ? C.amber : C.navy;
  const sevBg      = severity === "HIGH" ? C.crimsonG : severity === "MEDIUM" ? C.amberG : C.navyG;
  const trendColor = trend.includes("RISING") ? C.crimson : trend.includes("DROP") ? C.navyL : C.muted;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", height: 62, borderBottom: `1px solid ${C.border}`,
      background: C.panel, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ArcSenseLogo size={36} />
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 5, color: C.charcoal, lineHeight: 1 }}>ARCSENSE</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, letterSpacing: 2, color: C.mutedL }}>TESTNET INTELLIGENCE · ARC NETWORK</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${C.border}` }}>
        {[
          { label: "TREND",    value: trend,    color: trendColor },
          { label: "INSIGHT",  value: insight,  color: C.text, small: true },
          { label: "SEVERITY", value: severity, color: sevColor, bold: true, bg: sevBg },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "8px 20px", textAlign: "center",
            borderRight: i < 2 ? `1px solid ${C.border}` : "none",
            background: s.bg || "transparent",
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

// ── Stats row ─────────────────────────────────────────────────
function StatsRow({ blocks }) {
  const total    = blocks.reduce((s, b) => s + b.totalTx, 0);
  const failed   = blocks.reduce((s, b) => s + b.failedTx, 0);
  const avgRate  = blocks.length
    ? (blocks.reduce((s, b) => s + b.failureRate, 0) / blocks.length * 100).toFixed(2)
    : "0.00";
  const alerts   = blocks.filter(b => b.failureRate >= 0.10).length;
  const avgFloat = parseFloat(avgRate);

  const stats = [
    { label: "BLOCKS SCANNED",     value: blocks.length,          sub: "processed",   size: 24, accent: C.navy,    color: C.charcoal },
    { label: "TOTAL TRANSACTIONS", value: total.toLocaleString(),  sub: "on-chain",    size: 24, accent: C.navy,    color: C.charcoal },
    {
      label: "TOTAL FAILURES", value: failed.toLocaleString(), sub: "detected",
      size: failed > 0 ? 30 : 24,
      accent: failed > 0 ? C.crimson : C.navy,
      color:  failed > 0 ? C.crimson : C.charcoal,
      bg:     failed > 0 ? C.crimsonG : "transparent",
    },
    {
      label: "AVG FAILURE RATE", value: `${avgRate}%`, sub: "rolling avg",
      size:   avgFloat >= 10 ? 30 : avgFloat >= 5 ? 28 : 24,
      accent: avgFloat >= 10 ? C.crimson : avgFloat >= 5 ? C.amber : C.navy,
      color:  avgFloat >= 10 ? C.crimson : avgFloat >= 5 ? C.amber : C.charcoal,
      bg:     avgFloat >= 10 ? C.crimsonG : avgFloat >= 5 ? C.amberG : "transparent",
    },
    {
      label: "ALERTS TRIGGERED", value: alerts.toString(), sub: "≥10% spikes",
      size:   alerts > 0 ? 30 : 24,
      accent: alerts > 0 ? C.crimson : C.navy,
      color:  alerts > 0 ? C.crimson : C.charcoal,
      bg:     alerts > 0 ? C.crimsonG : "transparent",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, flexShrink: 0 }}>
      {stats.map((s, i) => (
        <HudPanel key={i} accent={s.accent} style={{ padding: "14px 18px", background: s.bg || C.panel }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 3, color: s.color === C.charcoal ? C.mutedL : s.color, marginBottom: 8, opacity: 0.8 }}>{s.label}</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: s.size, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, marginTop: 5 }}>{s.sub}</div>
        </HudPanel>
      ))}
    </div>
  );
}

// ── Block feed — fixed height, internal scroll, clickable addrs
function BlockFeed({ blocks }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [blocks]);

  return (
    <HudPanel label="BLOCK FEED" style={{ display: "flex", flexDirection: "column", overflow: "hidden", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL }}>LIVE STREAM</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{blocks.length}</span>
      </div>

      {/* Scrollable area — strictly contained, never grows page */}
      <div ref={ref} style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {blocks.slice(-60).map((b, i, arr) => {
          const isNew  = i >= arr.length - 3;
          const isCrit = b.failureRate >= 0.15;
          const isWarn = b.failureRate >= 0.10;
          const rowBg  = isCrit ? C.crimsonG : isWarn ? C.amberG : isNew ? C.navyG : "transparent";

          // top failing contract for this block
          const topEntry = Object.entries(b.topFailing || {}).sort((a, z) => z[1] - a[1])[0];
          const topAddr  = topEntry?.[0] || null;

          return (
            <div key={b.blockNumber} style={{
              padding: "6px 16px",
              borderLeft: `2px solid ${isCrit ? C.crimson : isWarn ? C.amber : isNew ? C.navy : C.borderL}`,
              background: rowBg,
              transition: "background 0.8s",
              animation: i === arr.length - 1 ? "fadeIn 0.4s ease" : "none",
            }}>
              {/* Row top: block number + status */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isCrit ? C.crimson : isNew ? C.navy : C.muted }}>
                  #{b.blockNumber.toLocaleString()}
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{b.totalTx}tx</span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: isCrit || isWarn ? 12 : 11, letterSpacing: 1, color: isCrit ? C.crimson : isWarn ? C.amber : C.navy }}>
                    {b.failedTx > 0 ? `${b.failedTx} FAIL` : "OK"}
                  </span>
                </div>
              </div>

              {/* Row bottom: failing contract if any */}
              {topAddr && (
                <div style={{ marginTop: 2 }}>
                  {isRealAddr(topAddr) ? (
                    <a
                      href={explorerUrl(topAddr)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={topAddr}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                        color: isCrit ? C.crimson : C.amber,
                        textDecoration: "none",
                        borderBottom: `1px dashed ${isCrit ? C.crimson : C.amber}44`,
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderBottomColor = isCrit ? C.crimson : C.amber}
                      onMouseLeave={e => e.currentTarget.style.borderBottomColor = `${isCrit ? C.crimson : C.amber}44`}
                    >
                      {shortAddr(topAddr)}
                    </a>
                  ) : (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>unknown</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}

// ── Chart ─────────────────────────────────────────────────────
function FailureChart({ chartData }) {
  return (
    <HudPanel label="FAILURE RATE · LAST 30 BLOCKS" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", minHeight: 0 }}>
      <div style={{ flex: 1, padding: "20px 8px 0 0", minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
            <XAxis dataKey="block"
              tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fill: C.mutedL }}
              axisLine={{ stroke: C.borderL }} tickLine={false}
              tickFormatter={v => String(v).slice(-4)} interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fill: C.mutedL }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} domain={[0, "auto"]} width={32}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={10} stroke={C.amber}   strokeDasharray="4 3" strokeWidth={1} />
            <ReferenceLine y={15} stroke={C.crimson}  strokeDasharray="4 3" strokeWidth={1} />
            <Line type="monotone" dataKey="avg"  stroke={C.mutedL} strokeWidth={1} dot={false} strokeDasharray="6 3" activeDot={false} />
            <Line type="monotone" dataKey="rate" stroke={C.navy}   strokeWidth={2} dot={false}
              activeDot={{ r: 4, fill: C.navy, stroke: C.panel, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 20, padding: "10px 20px 14px", borderTop: `1px solid ${C.borderL}`, flexShrink: 0, flexWrap: "wrap" }}>
        {[
          { color: C.navy,    label: "FAILURE RATE", dash: false },
          { color: C.mutedL,  label: "ROLLING AVG",  dash: true  },
          { color: C.amber,   label: "10% WARNING",  dash: true  },
          { color: C.crimson, label: "15% CRITICAL", dash: true  },
        ].map(t => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 14, borderTop: `${t.dash ? "1px dashed" : "2px solid"} ${t.color}` }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 1.5, color: t.color }}>{t.label}</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

// ── Contracts — shortened + clickable ─────────────────────────
function ContractsPanel({ blocks }) {
  const history = {};
  for (const b of blocks)
    for (const [addr, count] of Object.entries(b.topFailing || {}))
      history[addr] = (history[addr] || 0) + count;

  const sorted = Object.entries(history).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max    = sorted[0]?.[1] || 1;

  return (
    <HudPanel label="CONTRACT INTELLIGENCE" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "12px 18px 10px", borderBottom: `1px solid ${C.borderL}`, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, letterSpacing: 3, color: C.mutedL }}>FAILURE ACCUMULATION</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL }}>{sorted.length} tracked</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {sorted.length === 0
          ? <div style={{ padding: "24px 18px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.mutedL }}>No failures yet.</div>
          : sorted.map(([addr, count], i) => {
              const intensity = count / max;
              const barColor  = intensity > 0.7 ? C.crimson : intensity > 0.4 ? C.amber : C.navy;
              const rowBg     = intensity > 0.7 ? C.crimsonG : intensity > 0.4 ? C.amberG : "transparent";
              const canClick  = isRealAddr(addr);

              return (
                <div key={addr} style={{ padding: "10px 18px", borderBottom: `1px solid ${C.borderL}44`, background: rowBg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, color: C.white, background: barColor, padding: "1px 6px", fontWeight: 700 }}>{i + 1}</span>
                      {canClick ? (
                        <a
                          href={explorerUrl(addr)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={addr}
                          style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                            color: intensity > 0.7 ? C.crimson : C.navy,
                            textDecoration: "none",
                            borderBottom: `1px dashed ${intensity > 0.7 ? C.crimson : C.borderL}`,
                            cursor: "pointer",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = intensity > 0.7 ? C.crimson : C.navyL;
                            e.currentTarget.style.borderBottomColor = intensity > 0.7 ? C.crimson : C.navy;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = intensity > 0.7 ? C.crimson : C.navy;
                            e.currentTarget.style.borderBottomColor = intensity > 0.7 ? C.crimson : C.borderL;
                          }}
                        >
                          {shortAddr(addr)}
                        </a>
                      ) : (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: C.muted }}>{addr}</span>
                      )}
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: intensity > 0.7 ? 20 : intensity > 0.4 ? 17 : 14, color: barColor }}>{count}</span>
                  </div>
                  <div style={{ height: intensity > 0.7 ? 3 : 2, background: C.bgDeep }}>
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
  const bg     = isCrit ? "#FFF5F5" : "#FFFBF0";

  return (
    <div style={{
      position: "fixed", top: 74, right: 24, zIndex: 999,
      background: bg, borderLeft: `5px solid ${accent}`,
      border: `1px solid ${accent}`, borderRadius: 1,
      padding: "18px 22px", maxWidth: 390,
      boxShadow: `0 12px 50px ${accent}33, 0 4px 16px rgba(0,0,0,0.1)`,
      animation: "alertIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: 3, color: accent, display: "block" }}>
            {isCrit ? "⛔  CRITICAL ALERT" : "⚠️  WARNING ALERT"}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.mutedL, letterSpacing: 1 }}>
            {new Date().toLocaleTimeString()}
          </span>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: `1px solid ${C.borderL}`, color: C.muted, cursor: "pointer", fontSize: 11, padding: "2px 7px", borderRadius: 1, marginLeft: 12 }}>✕</button>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.text, marginBottom: 14, lineHeight: 1.8 }}>
        {isCrit ? "Severe" : "Abnormal"} failure spike —{" "}
        <span style={{ color: accent, fontWeight: 700, fontSize: 13 }}>{(alert.failureRate * 100).toFixed(0)}%</span>{" "}
        of transactions failed
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: C.muted, lineHeight: 2.2, borderTop: `1px solid ${accent}33`, paddingTop: 10, letterSpacing: 1 }}>
        <div>BLOCK · #{alert.blockNumber?.toLocaleString()}</div>
        <div>FAILED · {alert.failedTx} of {alert.totalTx} tx</div>
        {alert.topContract && isRealAddr(alert.topContract) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>CONTRACT ·</span>
            <a href={explorerUrl(alert.topContract)} target="_blank" rel="noopener noreferrer"
              style={{ color: accent, textDecoration: "none", borderBottom: `1px dashed ${accent}` }}>
              {shortAddr(alert.topContract)}
            </a>
          </div>
        ) : alert.topContract ? (
          <div>CONTRACT · unknown</div>
        ) : null}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function ArcSenseDashboard() {
  const [blocks, setBlocks]     = useState([]);
  const [alert, setAlert]       = useState(null);
  const alertedBlocks           = useRef(new Set());

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res  = await fetch("http://localhost:3001/reports");
        const data = await res.json();

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

  const latest   = blocks[blocks.length - 1];
  const trend    = getTrend(blocks);
  const severity = latest
    ? latest.failureRate >= 0.15 ? "HIGH"
    : latest.failureRate >= 0.10 ? "MEDIUM"
    : "LOW" : "LOW";
  const insight  = latest
    ? latest.failureRate >= 0.15 ? "Elevated failure rate detected across multiple transactions."
    : latest.failureRate >= 0.10 ? "Moderate failure activity detected."
    : "Network operating within normal parameters."
    : "Awaiting data...";

  const raw = blocks.slice(-30);
  const chartData = raw.map((b, i, arr) => {
    const window = arr.slice(Math.max(0, i - 4), i + 1);
    const avg    = window.reduce((s, x) => s + x.failureRate, 0) / window.length;
    return {
      block: b.blockNumber,
      rate:  parseFloat((b.failureRate * 100).toFixed(2)),
      avg:   parseFloat((avg * 100).toFixed(2)),
    };
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: ${C.bgDeep}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes alertIn { from{transform:translateX(40px) scale(0.95);opacity:0} to{transform:translateX(0) scale(1);opacity:1} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Root: exactly viewport height, no overflow */}
      <div style={{ background: C.bg, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <TopBar trend={trend} severity={severity} insight={insight} latestBlock={latest?.blockNumber} />

        {/* Content area — grows to fill remaining space */}
        <div style={{ flex: 1, padding: "14px 24px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", minHeight: 0 }}>
          <StatsRow blocks={blocks} />

          {/* Three-column grid — fills remaining height exactly */}
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 300px", gap: 12, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <BlockFeed blocks={blocks} />
            <FailureChart chartData={chartData} />
            <ContractsPanel blocks={blocks} />
          </div>
        </div>

        {/* Footer — always visible at bottom */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "11px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panel, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 1, color: C.muted }}>
            Powered by{" "}
            <a href="https://x.com/arc" target="_blank" rel="noopener noreferrer"
              style={{ color: C.navy, fontWeight: 700, textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color = C.navyL}
              onMouseLeave={e => e.target.style.color = C.navy}
            >Arc</a>
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 1, color: C.muted }}>
            Built by{" "}
            <a href="https://x.com/olumi441" target="_blank" rel="noopener noreferrer"
              style={{ color: C.navy, fontWeight: 700, textDecoration: "none" }}
              onMouseEnter={e => e.target.style.color = C.navyL}
              onMouseLeave={e => e.target.style.color = C.navy}
            >Abu Olumi</a>
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: 2, color: C.mutedL }}>
            Real-time signal intelligence for Arc Testnet
          </span>
        </div>
      </div>

      {alert && <AlertToast alert={alert} onDismiss={() => setAlert(null)} />}
    </>
  );
}