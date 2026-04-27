import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ErrorBar
} from "recharts";
import { SectionHeader } from "./BiasOverview";

const METRICS = [
  { key: "positive_rate", label: "Positive Rate", fmt: v => (v * 100).toFixed(1) + "%" },
  { key: "tpr",           label: "True Positive Rate (TPR)", fmt: v => v != null ? (v * 100).toFixed(1) + "%" : "N/A" },
  { key: "fpr",           label: "False Positive Rate (FPR)", fmt: v => v != null ? (v * 100).toFixed(1) + "%" : "N/A" },
  { key: "precision",     label: "Precision", fmt: v => v != null ? (v * 100).toFixed(1) + "%" : "N/A" },
  { key: "disparity",     label: "Disparity from Mean", fmt: v => (v * 100).toFixed(1) + "pp" },
];

export default function GroupDisparityChart({ data }) {
  const [metric, setMetric] = useState("positive_rate");
  const [view, setView]     = useState("both");

  const selMetric = METRICS.find(m => m.key === metric);
  const groups = data.before.bias_table.map(r => r.group);

  const chartData = groups.map((group, i) => {
    const b = data.before.bias_table[i];
    const a = data.after.bias_table.find(r => r.group === group) || data.after.bias_table[i];
    return {
      group: group.replace(" / ", "/"),
      before: b[metric] != null ? +(b[metric] * 100).toFixed(1) : null,
      after:  a?.[metric] != null ? +(a[metric] * 100).toFixed(1) : null,
      n: b.n,
    };
  });

  // Table data
  const tableRows = groups.map((group, i) => {
    const b = data.before.bias_table[i];
    const a = data.after.bias_table.find(r => r.group === group) || data.after.bias_table[i];
    return { group, b, a };
  });

  return (
    <div style={styles.wrap}>
      <SectionHeader
        title="Group Disparity Analysis"
        subtitle="Intersectional fairness metrics broken down by demographic subgroup"
      />

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <span style={styles.controlLabel}>Metric</span>
          <div style={styles.btnRow}>
            {METRICS.map(m => (
              <button
                key={m.key}
                style={{ ...styles.toggle, ...(metric === m.key ? styles.toggleActive : {}) }}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.controlGroup}>
          <span style={styles.controlLabel}>Show</span>
          <div style={styles.btnRow}>
            {["both", "before", "after"].map(v => (
              <button
                key={v}
                style={{ ...styles.toggle, ...(view === v ? styles.toggleActive : {}) }}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={styles.chartBox}>
        <h3 style={styles.chartTitle}>{selMetric.label} — by Demographic Group</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
            <XAxis dataKey="group" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tickFormatter={v => v + (metric === "disparity" ? "pp" : "%")} tick={{ fill: "#64748b", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontFamily: "monospace" }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 700 }}
              formatter={(v, n) => [v != null ? v + (metric === "disparity" ? "pp" : "%") : "N/A", n === "before" ? "Before" : "After"]}
            />
            <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 12, paddingTop: 12 }} />
            {(view === "both" || view === "before") && (
              <Bar dataKey="before" fill="#6366f1" radius={[4,4,0,0]} opacity={0.75} name="Before" />
            )}
            {(view === "both" || view === "after") && (
              <Bar dataKey="after" fill="#22c55e" radius={[4,4,0,0]} opacity={0.85} name="After" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed table */}
      <div style={styles.tableBox}>
        <h3 style={styles.chartTitle}>Full Fairness Table</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Group</th>
              <th style={styles.th}>N</th>
              <th style={styles.th}>Pos. Rate ↕</th>
              <th style={styles.th}>Disparity ↕</th>
              <th style={styles.th}>TPR ↕</th>
              <th style={styles.th}>FPR ↕</th>
              <th style={styles.th}>Precision ↕</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ group, b, a }) => (
              <React.Fragment key={group}>
                <tr style={styles.trBefore}>
                  <td style={{ ...styles.td, fontWeight: 700 }} rowSpan={2}>{group}</td>
                  <td style={styles.td}>{b.n}</td>
                  <Diff before={b.positive_rate} after={a?.positive_rate} fmt={v => (v*100).toFixed(1)+"%"} bigDiff />
                  <Diff before={b.disparity} after={a?.disparity} fmt={v => (v*100).toFixed(1)+"pp"} bigDiff lowerBetter />
                  <Diff before={b.tpr} after={a?.tpr} fmt={v => v != null ? (v*100).toFixed(1)+"%" : "N/A"} />
                  <Diff before={b.fpr} after={a?.fpr} fmt={v => v != null ? (v*100).toFixed(1)+"%" : "N/A"} lowerBetter />
                  <Diff before={b.precision} after={a?.precision} fmt={v => v != null ? (v*100).toFixed(1)+"%" : "N/A"} />
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div style={styles.tableLegend}>
          <span style={{ color: "#6366f1" }}>■</span> Before &nbsp;
          <span style={{ color: "#22c55e" }}>■</span> After &nbsp;
          <span style={{ color: "#f59e0b" }}>▲</span> Improved &nbsp;
          <span style={{ color: "#ef4444" }}>▼</span> Worsened
        </div>
      </div>
    </div>
  );
}

function Diff({ before, after, fmt, lowerBetter, bigDiff }) {
  const improved = after != null && before != null
    ? (lowerBetter ? after < before : after > before)
    : null;
  const changed = after != null && before != null && Math.abs(after - before) > 0.001;

  return (
    <td style={styles.td}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: "#94a3b8", fontSize: 11 }}>{fmt(before)}</span>
        <span style={{
          color: !changed ? "#64748b" : improved ? "#22c55e" : "#ef4444",
          fontWeight: changed ? 700 : 400,
          fontSize: 12,
        }}>
          {after != null ? fmt(after) : "—"}
          {changed && <span style={{ marginLeft: 4 }}>{improved ? "▲" : "▼"}</span>}
        </span>
      </div>
    </td>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 24 },
  controls: { display: "flex", flexDirection: "column", gap: 12 },
  controlGroup: { display: "flex", alignItems: "center", gap: 12 },
  controlLabel: { fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", minWidth: 50 },
  btnRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  toggle: {
    fontSize: 11,
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid rgba(99,102,241,0.2)",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  toggleActive: {
    background: "rgba(99,102,241,0.2)",
    border: "1px solid rgba(99,102,241,0.5)",
    color: "#a5b4fc",
  },
  chartBox: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 24,
  },
  chartTitle: { margin: "0 0 16px", fontSize: 14, color: "#e2e8f0", fontWeight: 700 },
  tableBox: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 24,
    overflowX: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: 10,
    letterSpacing: "0.1em",
    color: "#475569",
    textAlign: "left",
    padding: "8px 12px",
    borderBottom: "1px solid rgba(99,102,241,0.1)",
    fontWeight: 600,
  },
  td: {
    fontSize: 12,
    color: "#94a3b8",
    padding: "10px 12px",
    borderBottom: "1px solid rgba(99,102,241,0.06)",
    verticalAlign: "top",
  },
  trBefore: {},
  tableLegend: {
    marginTop: 16,
    fontSize: 11,
    color: "#475569",
    fontFamily: "system-ui, sans-serif",
  },
};
