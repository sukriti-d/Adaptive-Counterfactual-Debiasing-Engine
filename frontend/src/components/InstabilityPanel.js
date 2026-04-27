import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SectionHeader } from "./BiasOverview";

export default function InstabilityPanel({ data }) {
  const [scenario, setScenario] = useState(
    Object.keys(data.before.all_instability_scenarios)[0]
  );

  const scenarios = data.before.all_instability_scenarios;
  const scenData  = scenarios[scenario];
  const { instability: instB } = data.before;
  const { instability: instA } = data.after;

  const giData = scenData.group_instability.map(r => ({
    group: r.group.replace(" / ", "/"),
    instability: +(r.instability_rate * 100).toFixed(1),
    neg_to_pos: r.neg_to_pos,
    pos_to_neg: r.pos_to_neg,
  }));

  const compData = [
    { name: "Before", flip_rate: +(instB.flip_rate * 100).toFixed(1), idi: +instB.idi.toFixed(3) },
    { name: "After",  flip_rate: +(instA.flip_rate * 100).toFixed(1), idi: +instA.idi.toFixed(3) },
  ];

  const fb = scenData.flip_breakdown;
  const total = Object.values(fb).reduce((a, b) => a + b, 0);

  return (
    <div style={styles.wrap}>
      <SectionHeader
        title="Counterfactual Instability Analysis"
        subtitle="Measures how predictions change when protected attributes are flipped — a stable, fair model shows near-zero instability"
      />

      {/* Concept box */}
      <div style={styles.conceptBox}>
        <div style={styles.conceptIcon}>⬡</div>
        <div>
          <div style={styles.conceptTitle}>What is counterfactual instability?</div>
          <div style={styles.conceptDesc}>
            For each individual, we create a "counterfactual twin" — identical in skills and qualifications,
            but with a different protected attribute (e.g., Male→Female). If the model's prediction changes,
            it reveals direct discriminatory sensitivity. The <strong>Flip Rate</strong> measures how often
            this happens. The <strong>IDI Score</strong> measures the average probability shift.
          </div>
        </div>
      </div>

      {/* Scenario selector */}
      <div style={styles.scenRow}>
        <span style={styles.scenLabel}>Counterfactual Scenario</span>
        <div style={styles.btnRow}>
          {Object.keys(scenarios).map(s => (
            <button
              key={s}
              style={{ ...styles.toggle, ...(scenario === s ? styles.toggleActive : {}) }}
              onClick={() => setScenario(s)}
            >
              {s.replace("flip_", "flip ").replace("_", " + ")}
            </button>
          ))}
        </div>
      </div>

      {/* Summary metrics */}
      <div style={styles.metricRow}>
        <MetricTile
          label="Flip Rate (Before)"
          value={(instB.flip_rate * 100).toFixed(1) + "%"}
          sub={instB.flip_rate > 0.4 ? "HIGH — strong bias signal" : instB.flip_rate > 0.2 ? "MODERATE" : "LOW"}
          color={instB.flip_rate > 0.4 ? "#ef4444" : instB.flip_rate > 0.2 ? "#f59e0b" : "#22c55e"}
        />
        <MetricTile
          label="Flip Rate (After)"
          value={(instA.flip_rate * 100).toFixed(1) + "%"}
          sub={instA.flip_rate > 0.4 ? "HIGH" : instA.flip_rate > 0.2 ? "MODERATE" : "LOW — improved!"}
          color={instA.flip_rate > 0.4 ? "#ef4444" : instA.flip_rate > 0.2 ? "#f59e0b" : "#22c55e"}
        />
        <MetricTile
          label="IDI Before"
          value={instB.idi.toFixed(4)}
          sub="Avg. probability shift on flip"
          color="#6366f1"
        />
        <MetricTile
          label="IDI After"
          value={instA.idi.toFixed(4)}
          sub="Avg. probability shift on flip"
          color="#22c55e"
        />
      </div>

      {/* Group instability chart */}
      <div style={styles.chartBox}>
        <h3 style={styles.chartTitle}>Instability Rate by Group — Scenario: {scenario}</h3>
        <p style={styles.chartSub}>
          How often each group's prediction flips when the protected attribute is changed.
          Asymmetry reveals which groups are most discriminated against.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={giData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
            <XAxis dataKey="group" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tickFormatter={v => v + "%"} tick={{ fill: "#64748b", fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 700 }}
              formatter={(v, n, { payload }) => [
                v + "%",
                `Instability (neg→pos: ${payload.neg_to_pos}, pos→neg: ${payload.pos_to_neg})`
              ]}
            />
            <Bar dataKey="instability" radius={[4,4,0,0]}>
              {giData.map((d, i) => (
                <Cell key={i} fill={d.instability > 60 ? "#ef4444" : d.instability > 30 ? "#f59e0b" : "#6366f1"} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Flip breakdown */}
      <div style={styles.flipGrid}>
        <div style={styles.chartBox}>
          <h3 style={styles.chartTitle}>Prediction Transition Matrix</h3>
          <p style={styles.chartSub}>What happens to predictions when the protected attribute is flipped?</p>
          <div style={styles.matrix}>
            {[
              { key: "stable_neg", label: "Stable Negative\n(0→0)", color: "#22c55e", icon: "✓" },
              { key: "neg_to_pos", label: "Gained Outcome\n(0→1)", color: "#6366f1", icon: "↑" },
              { key: "pos_to_neg", label: "Lost Outcome\n(1→0)", color: "#ef4444", icon: "↓" },
              { key: "stable_pos", label: "Stable Positive\n(1→1)", color: "#22c55e", icon: "✓" },
            ].map(cell => (
              <div key={cell.key} style={{ ...styles.matrixCell, borderColor: cell.color + "40" }}>
                <div style={{ color: cell.color, fontSize: 28, marginBottom: 4 }}>{cell.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#e2e8f0" }}>{fb[cell.key]}</div>
                <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                  {cell.label}
                </div>
                <div style={{ fontSize: 10, color: cell.color, marginTop: 4 }}>
                  {((fb[cell.key] / total) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.chartBox}>
          <h3 style={styles.chartTitle}>Before vs After Instability</h3>
          <p style={styles.chartSub}>Flip rate and IDI comparison between baseline and debiased model</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={compData} layout="vertical" margin={{ top: 10, right: 40, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} width={50} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontFamily: "monospace" }}
                formatter={(v, n) => [n === "flip_rate" ? v + "%" : v, n === "flip_rate" ? "Flip Rate" : "IDI Score"]}
              />
              <Bar dataKey="flip_rate" fill="#ef4444" radius={[0,4,4,0]} opacity={0.8} name="flip_rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, sub, color }) {
  return (
    <div style={styles.tile}>
      <div style={styles.tileLabel}>{label}</div>
      <div style={{ ...styles.tileValue, color }}>{value}</div>
      <div style={styles.tileSub}>{sub}</div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 24 },
  conceptBox: {
    display: "flex",
    gap: 20,
    background: "rgba(99,102,241,0.06)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 12,
    padding: 20,
  },
  conceptIcon: { fontSize: 32, flexShrink: 0 },
  conceptTitle: { fontSize: 13, fontWeight: 700, color: "#a5b4fc", marginBottom: 6, letterSpacing: "0.05em" },
  conceptDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.7, fontFamily: "system-ui, sans-serif" },
  scenRow: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  scenLabel: { fontSize: 10, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" },
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  toggle: {
    fontSize: 11,
    padding: "5px 14px",
    borderRadius: 6,
    border: "1px solid rgba(99,102,241,0.2)",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  toggleActive: { background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.5)", color: "#a5b4fc" },
  metricRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  tile: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 10,
    padding: "16px 14px",
  },
  tileLabel: { fontSize: 9, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 },
  tileValue: { fontSize: 26, fontWeight: 800, marginBottom: 4 },
  tileSub: { fontSize: 10, color: "#475569", fontFamily: "system-ui, sans-serif" },
  chartBox: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 24,
  },
  chartTitle: { margin: "0 0 4px", fontSize: 14, color: "#e2e8f0", fontWeight: 700 },
  chartSub: { margin: "0 0 20px", fontSize: 12, color: "#64748b", fontFamily: "system-ui, sans-serif" },
  flipGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  matrix: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 },
  matrixCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: 16,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid",
    borderRadius: 10,
  },
};
