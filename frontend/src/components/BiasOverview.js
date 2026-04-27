import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function BiasOverview({ data }) {
  const { before, after, comparison } = data;

  const metricCards = [
    {
      label: "Fairness Score",
      before: (before.fairness_score * 100).toFixed(1) + "%",
      after: (after.fairness_score * 100).toFixed(1) + "%",
      change: "+" + (comparison.fairness_gain * 100).toFixed(1) + "%",
      positive: true,
      desc: "Composite score: 1 − [0.4·DPD + 0.4·EOV + 0.2·IDI]",
    },
    {
      label: "Dem. Parity Diff",
      before: before.metrics.demographic_parity_difference.toFixed(3),
      after: after.metrics.demographic_parity_difference.toFixed(3),
      change: "−" + comparison.dpd_reduction.toFixed(1) + "%",
      positive: true,
      desc: "Max positive-rate gap across demographic groups",
    },
    {
      label: "Eq. Odds Violation",
      before: before.metrics.equalized_odds_violation.toFixed(3),
      after: after.metrics.equalized_odds_violation.toFixed(3),
      change: "−" + comparison.eov_reduction.toFixed(1) + "%",
      positive: true,
      desc: "Max TPR/FPR gap across groups",
    },
    {
      label: "Flip Rate",
      before: (before.instability.flip_rate * 100).toFixed(1) + "%",
      after: (after.instability.flip_rate * 100).toFixed(1) + "%",
      change: "−" + comparison.flip_rate_reduction.toFixed(1) + "%",
      positive: true,
      desc: "% of predictions that flip when protected attr is counterfactually changed",
    },
    {
      label: "IDI Score",
      before: before.instability.idi.toFixed(3),
      after: after.instability.idi.toFixed(3),
      change: "−" + ((before.instability.idi - after.instability.idi) / before.instability.idi * 100).toFixed(1) + "%",
      positive: true,
      desc: "Individual Discrimination Index: mean |ΔP(ŷ=1)| per counterfactual flip",
    },
    {
      label: "Accuracy",
      before: (before.performance.accuracy * 100).toFixed(1) + "%",
      after: (after.performance.accuracy * 100).toFixed(1) + "%",
      change: "−" + (comparison.accuracy_cost * 100).toFixed(1) + "pp",
      positive: false,
      desc: "Classification accuracy (slight drop is acceptable fairness-accuracy tradeoff)",
    },
  ];

  // Bar chart data for positive rates by group (before/after)
  const chartData = before.bias_table.map((row, i) => ({
    group: row.group.replace(" / ", "/"),
    before: +(row.positive_rate * 100).toFixed(1),
    after: +(after.bias_table[i]?.positive_rate * 100 || 0).toFixed(1),
  }));

  return (
    <div style={styles.wrap}>
      <SectionHeader
        title="Bias Overview"
        subtitle="High-level summary of bias detected before and after mitigation"
      />

      {/* Metric cards */}
      <div style={styles.grid}>
        {metricCards.map(card => (
          <div key={card.label} style={styles.card}>
            <div style={styles.cardLabel}>{card.label}</div>
            <div style={styles.values}>
              <div style={styles.valBlock}>
                <span style={styles.valSubLabel}>Before</span>
                <span style={styles.valBig}>{card.before}</span>
              </div>
              <div style={styles.valArrow}>→</div>
              <div style={styles.valBlock}>
                <span style={styles.valSubLabel}>After</span>
                <span style={{ ...styles.valBig, color: card.positive ? "#22c55e" : "#f87171" }}>
                  {card.after}
                </span>
              </div>
            </div>
            <div style={{ ...styles.changeBadge, color: card.positive ? "#22c55e" : "#f87171", borderColor: card.positive ? "#22c55e44" : "#f8717144", background: card.positive ? "#22c55e11" : "#f8717111" }}>
              {card.change} reduction
            </div>
            <div style={styles.cardDesc}>{card.desc}</div>
          </div>
        ))}
      </div>

      {/* Positive Rate Chart */}
      <div style={styles.chartBox}>
        <h3 style={styles.chartTitle}>Positive Rate by Group — Before vs After Mitigation</h3>
        <p style={styles.chartSub}>Lower spread = more equitable outcomes across demographic groups</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
            <XAxis dataKey="group" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tickFormatter={v => v + "%"} tick={{ fill: "#64748b", fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontFamily: "monospace" }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(v, n) => [v + "%", n === "before" ? "Before" : "After"]}
            />
            <Bar dataKey="before" fill="#6366f1" radius={[4,4,0,0]} opacity={0.7} name="Before" />
            <Bar dataKey="after" fill="#22c55e" radius={[4,4,0,0]} opacity={0.85} name="After" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Disparate Impact */}
      <div style={styles.dirRow}>
        <DirMeter label="Before" value={before.metrics.disparate_impact_ratio} />
        <DirMeter label="After" value={after.metrics.disparate_impact_ratio} />
      </div>
    </div>
  );
}

function DirMeter({ label, value }) {
  const pct = Math.min(value * 100, 100);
  const color = value >= 0.8 ? "#22c55e" : value >= 0.5 ? "#f59e0b" : "#ef4444";
  const status = value >= 0.8 ? "✓ Meets 4/5ths Rule" : value >= 0.5 ? "⚠ Significant Gap" : "✗ Disparate Impact";
  return (
    <div style={styles.dirCard}>
      <div style={styles.dirLabel}>{label} — Disparate Impact Ratio</div>
      <div style={styles.dirValue}>{value.toFixed(4)}</div>
      <div style={styles.dirBar}>
        <div style={{ ...styles.dirFill, width: pct + "%", background: color }} />
        <div style={styles.dirThreshold} title="0.8 threshold (4/5ths rule)" />
      </div>
      <div style={{ color, fontSize: 11, marginTop: 6, letterSpacing: "0.05em" }}>{status}</div>
    </div>
  );
}

export function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.01em" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", fontFamily: "system-ui, sans-serif" }}>{subtitle}</p>}
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 28 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  card: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: "20px 18px",
  },
  cardLabel: { fontSize: 10, color: "#6366f1", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 },
  values: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  valBlock: { display: "flex", flexDirection: "column" },
  valSubLabel: { fontSize: 9, color: "#475569", marginBottom: 2 },
  valBig: { fontSize: 22, fontWeight: 800, color: "#e2e8f0" },
  valArrow: { color: "#334155", fontSize: 16, marginTop: 10 },
  changeBadge: {
    display: "inline-block",
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 20,
    border: "1px solid",
    marginBottom: 8,
  },
  cardDesc: { fontSize: 11, color: "#475569", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" },
  chartBox: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 24,
  },
  chartTitle: { margin: "0 0 4px", fontSize: 15, color: "#e2e8f0", fontWeight: 700 },
  chartSub: { margin: "0 0 20px", fontSize: 12, color: "#64748b", fontFamily: "system-ui, sans-serif" },
  dirRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  dirCard: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 20,
  },
  dirLabel: { fontSize: 11, color: "#6366f1", letterSpacing: "0.1em", marginBottom: 8 },
  dirValue: { fontSize: 28, fontWeight: 800, color: "#e2e8f0", marginBottom: 12 },
  dirBar: { position: "relative", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "visible" },
  dirFill: { height: "100%", borderRadius: 4, transition: "width 0.6s ease" },
  dirThreshold: {
    position: "absolute",
    left: "80%",
    top: -4,
    height: 16,
    width: 2,
    background: "#f59e0b",
    borderRadius: 1,
  },
};
