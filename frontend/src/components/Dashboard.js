import React, { useState } from "react";
import BiasOverview from "./BiasOverview";
import GroupDisparityChart from "./GroupDisparityChart";
import InstabilityPanel from "./InstabilityPanel";
import RadarChart from "./RadarChart";
import TradeoffSummary from "./TradeoffSummary";
import BiasExplainer from "./BiasExplainer";
import DataPreview from "./DataPreview";

const TABS = [
  { id: "overview",   label: "Overview",        icon: "◈" },
  { id: "disparity",  label: "Group Disparity",  icon: "◉" },
  { id: "instability",label: "Counterfactual",   icon: "⬡" },
  { id: "radar",      label: "Fairness Radar",   icon: "◎" },
  { id: "tradeoff",   label: "Tradeoff",         icon: "⊞" },
  { id: "explainer",  label: "Explanation",      icon: "✦" },
  { id: "data",       label: "Dataset",          icon: "≡" },
];

export default function Dashboard({ data, sessionId, onReset, source }) {
  const [tab, setTab] = useState("overview");

  return (
    <div style={styles.page}>
      <div style={styles.grid} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={onReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            New Analysis
          </button>
          <div style={styles.logo}>ACDE</div>
          <div style={styles.headerBadge}>
            {source === "demo" ? "Synthetic Dataset" : "Custom Dataset"} · {data.n_rows.toLocaleString()} rows
          </div>
        </div>
        <div style={styles.headerRight}>
          <ScoreChip label="Before" score={data.before.fairness_score} />
          <span style={styles.arrow}>→</span>
          <ScoreChip label="After" score={data.after.fairness_score} accent />
        </div>
      </header>

      {/* Tab nav */}
      <nav style={styles.nav}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            <span style={styles.tabIcon}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={styles.main}>
        {tab === "overview"    && <BiasOverview data={data} />}
        {tab === "disparity"   && <GroupDisparityChart data={data} />}
        {tab === "instability" && <InstabilityPanel data={data} />}
        {tab === "radar"       && <RadarChart data={data} />}
        {tab === "tradeoff"    && <TradeoffSummary data={data} />}
        {tab === "explainer"   && <BiasExplainer data={data} sessionId={sessionId}  />}
        {tab === "data"        && <DataPreview data={data} sessionId={sessionId} />}
      </main>
    </div>
  );
}

function ScoreChip({ label, score, accent }) {
  const color = score >= 0.7 ? "#22c55e" : score >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{
      ...styles.chip,
      ...(accent ? { border: `1px solid ${color}40`, background: `${color}15` } : {}),
    }}>
      <span style={styles.chipLabel}>{label}</span>
      <span style={{ ...styles.chipScore, color }}>{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
    color: "#e2e8f0",
    position: "relative",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
    pointerEvents: "none",
    zIndex: 0,
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    height: 64,
    background: "rgba(5,8,22,0.95)",
    borderBottom: "1px solid rgba(99,102,241,0.15)",
    backdropFilter: "blur(12px)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "1px solid rgba(99,102,241,0.25)",
    color: "#94a3b8",
    fontSize: 11,
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.05em",
  },
  logo: {
    fontSize: 20,
    fontWeight: 900,
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "0.05em",
  },
  headerBadge: {
    fontSize: 10,
    color: "#475569",
    background: "rgba(99,102,241,0.08)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 4,
    padding: "3px 8px",
    letterSpacing: "0.08em",
  },
  chip: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "6px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    minWidth: 64,
  },
  chipLabel: { fontSize: 9, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" },
  chipScore: { fontSize: 22, fontWeight: 800, lineHeight: 1.2 },
  arrow: { color: "#475569", fontSize: 18 },
  nav: {
    display: "flex",
    gap: 0,
    padding: "0 32px",
    borderBottom: "1px solid rgba(99,102,241,0.1)",
    background: "rgba(5,8,22,0.8)",
    position: "sticky",
    top: 64,
    zIndex: 99,
    overflowX: "auto",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "14px 18px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#475569",
    fontSize: 12,
    letterSpacing: "0.06em",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
  },
  tabBtnActive: {
    color: "#a5b4fc",
    borderBottomColor: "#6366f1",
  },
  tabIcon: { fontSize: 14, opacity: 0.7 },
  main: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "32px 32px",
    position: "relative",
    zIndex: 1,
  },
};
