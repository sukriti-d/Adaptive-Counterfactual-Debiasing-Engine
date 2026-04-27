import React from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Label
} from "recharts";
import { SectionHeader } from "./BiasOverview";

export default function TradeoffSummary({ data }) {
  const { before, after, comparison } = data;

  const tableRows = [
    { metric: "Accuracy",                  before: before.performance.accuracy,        after: after.performance.accuracy,       fmt: v => (v*100).toFixed(2)+"%", lowerBetter: false },
    { metric: "Balanced Accuracy",         before: before.performance.balanced,        after: after.performance.balanced,       fmt: v => (v*100).toFixed(2)+"%", lowerBetter: false },
    { metric: "F1 Score",                  before: before.performance.f1,              after: after.performance.f1,             fmt: v => (v*100).toFixed(2)+"%", lowerBetter: false },
    { metric: "ROC AUC",                   before: before.performance.roc_auc,         after: after.performance.roc_auc,        fmt: v => v.toFixed(4), lowerBetter: false },
    { metric: "─────────────────────",     before: null, after: null, divider: true },
    { metric: "Composite Fairness Score ↑", before: before.fairness_score,             after: after.fairness_score,             fmt: v => (v*100).toFixed(2)+"%", lowerBetter: false },
    { metric: "Max Group Disparity ↓",     before: before.bias_table[0]?.disparity,    after: after.bias_table[0]?.disparity,   fmt: v => v.toFixed(4), lowerBetter: true },
    { metric: "Dem. Parity Difference ↓",  before: before.metrics.demographic_parity_difference, after: after.metrics.demographic_parity_difference, fmt: v => v.toFixed(4), lowerBetter: true },
    { metric: "Eq. Odds Violation ↓",      before: before.metrics.equalized_odds_violation,      after: after.metrics.equalized_odds_violation,      fmt: v => v.toFixed(4), lowerBetter: true },
    { metric: "Pred. Parity Diff ↓",       before: before.metrics.predictive_parity_difference,  after: after.metrics.predictive_parity_difference,  fmt: v => v.toFixed(4), lowerBetter: true },
    { metric: "Disparate Impact Ratio ↑",  before: before.metrics.disparate_impact_ratio,        after: after.metrics.disparate_impact_ratio,        fmt: v => v.toFixed(4), lowerBetter: false },
    { metric: "Counterfactual Flip Rate ↓",before: before.instability.flip_rate,       after: after.instability.flip_rate,      fmt: v => (v*100).toFixed(2)+"%", lowerBetter: true },
    { metric: "IDI Score ↓",               before: before.instability.idi,             after: after.instability.idi,            fmt: v => v.toFixed(4), lowerBetter: true },
  ];

  const reductionRows = [
    { label: "Bias Reduction (Max Disparity)",       value: comparison.bias_reduction,        unit: "%" },
    { label: "DPD Reduction",                         value: comparison.dpd_reduction,         unit: "%" },
    { label: "EOV Reduction",                         value: comparison.eov_reduction,         unit: "%" },
    { label: "Flip Rate Reduction",                   value: comparison.flip_rate_reduction,   unit: "%" },
    { label: "Fairness Score Gain",                   value: +(comparison.fairness_gain * 100).toFixed(2), unit: "pts" },
    { label: "Accuracy Cost",                         value: +(comparison.accuracy_cost * 100).toFixed(2), unit: "pp", negative: true },
  ];

  // Scatter chart: fairness vs accuracy (2 points)
  const scatter = [
    { x: +(before.performance.accuracy * 100).toFixed(2), y: +(before.fairness_score * 100).toFixed(2), name: "Before" },
    { x: +(after.performance.accuracy * 100).toFixed(2),  y: +(after.fairness_score * 100).toFixed(2),  name: "After" },
  ];

  return (
    <div style={styles.wrap}>
      <SectionHeader
        title="Fairness–Utility Tradeoff Summary"
        subtitle="Complete before/after comparison with bias reduction metrics and accuracy cost analysis"
      />

      {/* Hero reduction cards */}
      <div style={styles.heroGrid}>
        {reductionRows.map(r => (
          <div key={r.label} style={{ ...styles.heroCard, borderColor: r.negative ? "#ef444440" : "#22c55e40" }}>
            <div style={styles.heroLabel}>{r.label}</div>
            <div style={{ ...styles.heroValue, color: r.negative ? "#ef4444" : "#22c55e" }}>
              {r.negative ? "−" : "+"}{Math.abs(r.value)}{r.unit}
            </div>
          </div>
        ))}
      </div>

      {/* Full metrics table */}
      <div style={styles.tableBox}>
        <h3 style={styles.tableTitle}>Complete Metrics Table</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Metric</th>
              <th style={{ ...styles.th, color: "#6366f1" }}>Before</th>
              <th style={{ ...styles.th, color: "#22c55e" }}>After</th>
              <th style={styles.th}>Change</th>
              <th style={styles.th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => {
              if (row.divider) return (
                <tr key={i}>
                  <td colSpan={5} style={{ borderBottom: "1px solid rgba(99,102,241,0.12)", padding: "4px 0", color: "#334155", fontSize: 10 }}>
                    ────────── FAIRNESS METRICS ──────────
                  </td>
                </tr>
              );
              if (row.before == null) return null;

              const improved = row.lowerBetter
                ? row.after < row.before
                : row.after > row.before;
              const delta = row.after - row.before;
              const pct = row.before !== 0 ? (delta / Math.abs(row.before) * 100).toFixed(1) : "—";

              return (
                <tr key={i} style={{ borderBottom: "1px solid rgba(99,102,241,0.06)" }}>
                  <td style={styles.td}>{row.metric}</td>
                  <td style={{ ...styles.td, color: "#6366f1" }}>{row.fmt(row.before)}</td>
                  <td style={{ ...styles.td, color: "#22c55e" }}>{row.fmt(row.after)}</td>
                  <td style={{ ...styles.td, color: improved ? "#22c55e" : "#ef4444" }}>
                    {delta >= 0 ? "+" : ""}{(delta * (row.fmt(1).includes("%") ? 100 : 1)).toFixed(2)}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: improved ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: improved ? "#22c55e" : "#ef4444",
                      border: `1px solid ${improved ? "#22c55e40" : "#ef444440"}`,
                    }}>
                      {improved ? "▲ Improved" : "▼ Cost"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Scatter chart */}
      <div style={styles.chartBox}>
        <h3 style={styles.chartTitle}>Fairness–Accuracy Space</h3>
        <p style={styles.chartSub}>Ideal: upper-right (high accuracy + high fairness). Mitigation shifts the model toward fairer outcomes.</p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 40, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
            <XAxis
              dataKey="x"
              type="number"
              name="Accuracy"
              domain={[
                Math.min(scatter[0].x, scatter[1].x) - 5,
                Math.max(scatter[0].x, scatter[1].x) + 5
              ]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickFormatter={v => v + "%"}
            >
              <Label value="Accuracy →" position="bottom" fill="#64748b" fontSize={12} />
            </XAxis>
            <YAxis
              dataKey="y"
              type="number"
              name="Fairness Score"
              domain={[0, 100]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickFormatter={v => v + "%"}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "#334155" }}
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontFamily: "monospace" }}
              formatter={(v, n) => [v + "%", n]}
            />
            <Scatter
              data={[scatter[0]]}
              fill="#6366f1"
              r={12}
              name="Before"
              label={{ value: "Before", fill: "#6366f1", fontSize: 12, dy: -16 }}
            />
            <Scatter
              data={[scatter[1]]}
              fill="#22c55e"
              r={12}
              name="After"
              label={{ value: "After", fill: "#22c55e", fontSize: 12, dy: -16 }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 24 },
  heroGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  heroCard: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid",
    borderRadius: 12,
    padding: "18px 16px",
  },
  heroLabel: { fontSize: 10, color: "#64748b", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "system-ui, sans-serif" },
  heroValue: { fontSize: 28, fontWeight: 900 },
  tableBox: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 24,
    overflowX: "auto",
  },
  tableTitle: { margin: "0 0 16px", fontSize: 15, color: "#e2e8f0", fontWeight: 700 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: 10,
    letterSpacing: "0.1em",
    color: "#475569",
    textAlign: "left",
    padding: "8px 12px",
    borderBottom: "1px solid rgba(99,102,241,0.15)",
    fontWeight: 600,
    textTransform: "uppercase",
  },
  td: {
    fontSize: 12,
    color: "#94a3b8",
    padding: "10px 12px",
    verticalAlign: "middle",
  },
  chartBox: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 24,
  },
  chartTitle: { margin: "0 0 4px", fontSize: 14, color: "#e2e8f0", fontWeight: 700 },
  chartSub: { margin: "0 0 20px", fontSize: 12, color: "#64748b", fontFamily: "system-ui, sans-serif" },
};
