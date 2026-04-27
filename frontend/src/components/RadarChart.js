import React from "react";
import {
  RadarChart as ReRadar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { SectionHeader } from "./BiasOverview";

// ── Per-metric worst/best reference points for meaningful normalisation ──────
// Each metric maps its raw value to a 0–100 display scale independently so
// that a "bad" Before score never collapses to a near-zero dot.
//
// displayScore = 8 + 87 * clamp((raw - worst) / (best - worst), 0, 1)
// → worst raw  → 8  (always visible)
// → best  raw  → 95 (never reaches the edge, leaving room for the grid)
const METRICS = [
  {
    key:      "dem_parity",
    metric:   "Dem. Parity",
    fullName: "Demographic Parity",
    desc:     "1 − DPD. Higher = more equitable positive rates across groups.",
    worst: 0,  // raw=0 → display=8
    best:  1,  // raw=1 → display=95
    raw: (b, a) => ({
      before: +(1 - b.metrics.demographic_parity_difference).toFixed(4),
      after:  +(1 - a.metrics.demographic_parity_difference).toFixed(4),
    }),
  },
  {
    key:      "eq_odds",
    metric:   "Eq. Odds",
    fullName: "Equalized Odds",
    desc:     "1 − EOV. Higher = more balanced TPR/FPR across groups.",
    worst: 0,
    best:  1,
    raw: (b, a) => ({
      before: +(1 - b.metrics.equalized_odds_violation).toFixed(4),
      after:  +(1 - a.metrics.equalized_odds_violation).toFixed(4),
    }),
  },
  {
    key:      "pred_parity",
    metric:   "Pred. Parity",
    fullName: "Predictive Parity",
    desc:     "1 − PPD. Higher = more consistent precision across groups.",
    worst: 0,
    best:  1,
    raw: (b, a) => ({
      before: +(1 - b.metrics.predictive_parity_difference).toFixed(4),
      after:  +(1 - a.metrics.predictive_parity_difference).toFixed(4),
    }),
  },
  {
    key:      "counterfact",
    metric:   "Counterfact.",
    fullName: "Counterfactual Stability",
    desc:     "1 − Flip Rate. Higher = predictions stable when protected attrs change.",
    worst: 0,
    best:  1,
    raw: (b, a) => ({
      before: +(1 - b.instability.flip_rate).toFixed(4),
      after:  +(1 - a.instability.flip_rate).toFixed(4),
    }),
  },
  {
    key:      "idi",
    metric:   "IDI Stability",
    fullName: "Individual Stability (IDI)",
    desc:     "1 − IDI. Higher = smaller probability shifts on counterfactual flips.",
    worst: 0,
    best:  1,
    raw: (b, a) => ({
      before: +(1 - b.instability.idi).toFixed(4),
      after:  +(1 - a.instability.idi).toFixed(4),
    }),
  },
  {
    key:      "disp_impact",
    metric:   "Disp. Impact",
    fullName: "Disparate Impact Ratio",
    desc:     "Min group rate / Max group rate. ≥ 0.8 meets the 4/5ths rule.",
    worst: 0,
    best:  1,
    raw: (b, a) => ({
      before: +Math.min(b.metrics.disparate_impact_ratio, 1).toFixed(4),
      after:  +Math.min(a.metrics.disparate_impact_ratio, 1).toFixed(4),
    }),
  },
];

const DISPLAY_MIN = 8;
const DISPLAY_MAX = 95;

function toDisplay(raw, worst, best) {
  const range = best - worst || 1;
  const clamped = Math.max(0, Math.min(1, (raw - worst) / range));
  return +(DISPLAY_MIN + (DISPLAY_MAX - DISPLAY_MIN) * clamped).toFixed(1);
}

const BAND_LABELS = [
  { value: 20,  label: "Worst",  color: "#ef4444" },
  { value: 38,  label: "Poor",   color: "#f97316" },
  { value: 56,  label: "Fair",   color: "#eab308" },
  { value: 74,  label: "Good",   color: "#84cc16" },
  { value: 92,  label: "Best",   color: "#22c55e" },
];

function bandColor(displayVal) {
  if (displayVal < 27) return "#ef4444";
  if (displayVal < 47) return "#f97316";
  if (displayVal < 65) return "#eab308";
  if (displayVal < 83) return "#84cc16";
  return "#22c55e";
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 10, padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: 12, minWidth: 220 }}>
      <div style={{ color: "#e2e8f0", fontWeight: 700, marginBottom: 8 }}>{d.fullName}</div>
      <div style={{ color: "#94a3b8", marginBottom: 4, fontSize: 10 }}>{d.desc}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#818cf8" }}>Before</span>
          <span style={{ color: "#818cf8", fontWeight: 700 }}>{(d.rawBefore * 100).toFixed(1)}%</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#22c55e" }}>After</span>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>{(d.rawAfter * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default function RadarChart({ data }) {
  const { before, after } = data;

  const radarData = METRICS.map(m => {
    const { before: rawB, after: rawA } = m.raw(before, after);
    return {
      metric:    m.metric,
      fullName:  m.fullName,
      desc:      m.desc,
      before:    toDisplay(rawB, m.worst, m.best),
      after:     toDisplay(rawA, m.worst, m.best),
      rawBefore: rawB,
      rawAfter:  rawA,
    };
  });

  return (
    <div style={styles.wrap}>
      <SectionHeader
        title="Fairness Radar"
        subtitle="Per-metric normalised fairness — each axis independently scaled (8 = worst, 95 = best). Hover for real values."
      />

      <div style={styles.layout}>
        {/* Radar */}
        <div style={styles.chartBox}>
          {/* Band legend */}
          <div style={styles.bandLegend}>
            {BAND_LABELS.map(b => (
              <span key={b.label} style={{ ...styles.bandChip, color: b.color, borderColor: b.color + "44" }}>
                {b.label}
              </span>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={420}>
            <ReRadar cx="50%" cy="50%" outerRadius="72%" data={radarData}>
              <PolarGrid
                stroke="rgba(99,102,241,0.18)"
                gridType="polygon"
              />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: "#94a3b8", fontSize: 12, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="Before Mitigation"
                dataKey="before"
                stroke="#818cf8"
                fill="#6366f1"
                fillOpacity={0.35}
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#ffffff", strokeWidth: 2, stroke: "#6366f1" }}
                activeDot={{ r: 6, fill: "#ffffff", strokeWidth: 2, stroke: "#6366f1" }}
              />
              <Radar
                name="After Mitigation"
                dataKey="after"
                stroke="#4ade80"
                fill="#22c55e"
                fillOpacity={0.3}
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#ffffff", strokeWidth: 2, stroke: "#22c55e" }}
                activeDot={{ r: 6, fill: "#ffffff", strokeWidth: 2, stroke: "#22c55e" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, paddingTop: 16 }}
              />
            </ReRadar>
          </ResponsiveContainer>
        </div>

        {/* Metric detail list */}
        <div style={styles.metricList}>
          {radarData.map(m => {
            const improved = m.rawAfter > m.rawBefore;
            const delta    = ((m.rawAfter - m.rawBefore) * 100).toFixed(1);
            const bColor   = bandColor(m.before);
            const aColor   = bandColor(m.after);
            return (
              <div key={m.metric} style={styles.metricItem}>
                <div style={styles.metricHeader}>
                  <span style={styles.metricName}>{m.fullName}</span>
                  <span style={{ color: improved ? "#4ade80" : "#ef4444", fontSize: 12, fontWeight: 700 }}>
                    {improved ? "▲" : "▼"} {Math.abs(delta)}pts
                  </span>
                </div>
                <div style={styles.barRow}>
                  <span style={{ fontSize: 10, color: "#818cf8", width: 46, flexShrink: 0 }}>Before</span>
                  <div style={styles.barTrack}>
                    <div style={{ ...styles.barFill, width: m.before + "%", background: "#6366f1" }} />
                  </div>
                  <span style={{ color: bColor, fontSize: 11, width: 44, textAlign: "right" }}>
                    {(m.rawBefore * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={styles.barRow}>
                  <span style={{ fontSize: 10, color: "#4ade80", width: 46, flexShrink: 0 }}>After</span>
                  <div style={styles.barTrack}>
                    <div style={{ ...styles.barFill, width: m.after + "%", background: "#22c55e" }} />
                  </div>
                  <span style={{ color: aColor, fontSize: 11, width: 44, textAlign: "right" }}>
                    {(m.rawAfter * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={styles.metricDesc}>{m.desc}</div>
              </div>
            );
          })}

          {/* Composite score */}
          <div style={styles.compositeBox}>
            <div style={styles.compositeLabel}>COMPOSITE FAIRNESS SCORE</div>
            <div style={styles.compositeRow}>
              <div>
                <div style={styles.compositeSubLabel}>Before</div>
                <div style={{ ...styles.compositeValue, color: "#818cf8" }}>
                  {(data.before.fairness_score * 100).toFixed(1)}%
                </div>
              </div>
              <div style={styles.compositeArrow}>→</div>
              <div>
                <div style={styles.compositeSubLabel}>After</div>
                <div style={{ ...styles.compositeValue, color: "#22c55e" }}>
                  {(data.after.fairness_score * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ ...styles.compositeValue, fontSize: 18, color: "#f59e0b", marginLeft: 8 }}>
                +{(data.comparison.fairness_gain * 100).toFixed(1)}pts
              </div>
            </div>
            <div style={styles.metricDesc}>
              F = 1 − [0.4·DPD + 0.4·EOV + 0.2·IDI] &nbsp;|&nbsp; 1.0 = perfectly fair
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap:    { display: "flex", flexDirection: "column", gap: 24 },
  layout:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" },
  chartBox: {
    background:   "rgba(15,23,42,0.7)",
    border:       "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding:      24,
  },
  bandLegend: {
    display:        "flex",
    gap:            6,
    marginBottom:   12,
    justifyContent: "center",
  },
  bandChip: {
    fontSize:     10,
    padding:      "2px 8px",
    borderRadius: 20,
    border:       "1px solid",
    fontFamily:   "IBM Plex Mono, monospace",
    letterSpacing: "0.04em",
  },
  metricList: { display: "flex", flexDirection: "column", gap: 14 },
  metricItem: {
    background:   "rgba(15,23,42,0.7)",
    border:       "1px solid rgba(99,102,241,0.1)",
    borderRadius: 10,
    padding:      "14px 16px",
  },
  metricHeader: { display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" },
  metricName:   { fontSize: 12, color: "#e2e8f0", fontWeight: 600, letterSpacing: "0.04em" },
  barRow:       { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 },
  barTrack: {
    flex:         1,
    height:       7,
    background:   "rgba(255,255,255,0.05)",
    borderRadius: 4,
    overflow:     "hidden",
  },
  barFill: { height: "100%", borderRadius: 4, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" },
  metricDesc: { fontSize: 10, color: "#475569", lineHeight: 1.5, marginTop: 6, fontFamily: "system-ui, sans-serif" },
  compositeBox: {
    background:   "rgba(99,102,241,0.07)",
    border:       "1px solid rgba(99,102,241,0.25)",
    borderRadius: 10,
    padding:      "16px 16px",
  },
  compositeLabel:    { fontSize: 9, letterSpacing: "0.15em", color: "#6366f1", marginBottom: 12, textTransform: "uppercase" },
  compositeRow:      { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  compositeSubLabel: { fontSize: 9, color: "#475569", marginBottom: 4 },
  compositeValue:    { fontSize: 28, fontWeight: 800, lineHeight: 1 },
  compositeArrow:    { color: "#334155", fontSize: 20 },
};