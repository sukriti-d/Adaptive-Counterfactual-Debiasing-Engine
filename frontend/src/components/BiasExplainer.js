import React from "react";
import { SectionHeader } from "./BiasOverview";

export default function BiasExplainer({ data }) {
  const { before, after, comparison, protected_attributes } = data;

  // Determine severity
  const dpd = before.metrics.demographic_parity_difference;
  const eov = before.metrics.equalized_odds_violation;
  const flipRate = before.instability.flip_rate;
  const dir = before.metrics.disparate_impact_ratio;
  const fs = before.fairness_score;
  const fsAfter = after.fairness_score;

  const severity = fs < 0.3 ? "critical" : fs < 0.5 ? "high" : fs < 0.7 ? "moderate" : "low";
  const severityColor = { critical: "#ef4444", high: "#f97316", moderate: "#f59e0b", low: "#22c55e" }[severity];
  const severityLabel = severity.toUpperCase();

  // Find worst group
  const worstGroup = before.bias_table[0];
  const bestGroup  = before.bias_table[before.bias_table.length - 1];

  const findings = [
    {
      icon: "⚠",
      color: "#ef4444",
      title: "Intersectional Bias Detected",
      body: `The model shows a ${(dpd * 100).toFixed(1)} percentage-point gap in positive outcome rates between 
        the most and least favored demographic groups. The most advantaged group (${bestGroup?.group}) 
        receives positive outcomes ${(bestGroup?.positive_rate * 100).toFixed(1)}% of the time, 
        compared to only ${(worstGroup?.positive_rate * 100).toFixed(1)}% for the most disadvantaged 
        group (${worstGroup?.group}). This ${(dpd * 100).toFixed(1)}pp gap is ${dpd > 0.5 ? "severe" : dpd > 0.2 ? "significant" : "mild"} and 
        indicates the model's decisions are strongly correlated with protected attributes.`,
    },
    {
      icon: "⬡",
      color: "#6366f1",
      title: "Counterfactual Discrimination Found",
      body: `When we create "counterfactual twins" — identical individuals except for their protected 
        attribute — ${(flipRate * 100).toFixed(1)}% of predictions change. This means ${Math.round(flipRate * data.n_rows)} 
        people out of ${data.n_rows.toLocaleString()} would receive a different outcome purely because 
        of their gender or race, not because of their qualifications. The Individual Discrimination 
        Index (IDI) of ${before.instability.idi.toFixed(3)} confirms that the model's confidence 
        shifts substantially when only protected attributes change.`,
    },
    {
      icon: "⚖",
      color: "#f59e0b",
      title: "Equalized Odds Violation",
      body: `The model's True Positive Rate (sensitivity) and False Positive Rate (specificity) differ 
        significantly across groups (violation: ${(eov * 100).toFixed(1)}pp). This means equally 
        qualified individuals from different demographic groups do not have equal chances of being 
        correctly identified for positive outcomes. The 4/5ths disparate impact test 
        ${dir < 0.8 ? `also fails (ratio: ${dir.toFixed(3)} < 0.8 threshold), indicating legally significant disparate impact under many fairness regulations` : `passes (ratio: ${dir.toFixed(3)} ≥ 0.8)`}.`,
    },
    {
      icon: "✦",
      color: "#22c55e",
      title: "Mitigation Results",
      body: `After applying Inverse Probability Weighting (IPW) with iterative disparity correction, 
        the Composite Fairness Score improved from ${(before.fairness_score * 100).toFixed(1)}% to 
        ${(after.fairness_score * 100).toFixed(1)}% (+${(comparison.fairness_gain * 100).toFixed(1)}pts). 
        Demographic parity difference dropped by ${comparison.dpd_reduction}%, equalized odds violation 
        reduced by ${comparison.eov_reduction}%, and the flip rate fell from ${(before.instability.flip_rate * 100).toFixed(1)}% 
        to ${(after.instability.flip_rate * 100).toFixed(1)}%. The accuracy cost was minimal at 
        ${(comparison.accuracy_cost * 100).toFixed(2)} percentage points, demonstrating that 
        fairness and performance are not mutually exclusive.`,
    },
  ];

  const recommendations = [
    {
      priority: "Critical",
      color: "#ef4444",
      action: "Deploy only the debiased model",
      detail: `The baseline model shows unacceptable bias (fairness score ${(fs*100).toFixed(1)}%). 
        The mitigated model should be used for any real decisions.`,
    },
    {
      priority: "High",
      color: "#f97316",
      action: "Monitor ongoing fairness in production",
      detail: `Even after mitigation, disparate impact ratio (${after.metrics.disparate_impact_ratio.toFixed(3)}) 
        remains below the 0.80 threshold. Continuous monitoring is required.`,
    },
    {
      priority: "High",
      color: "#f59e0b",
      action: "Investigate data collection bias",
      detail: `Historical bias in training data is a root cause. Audit data collection practices 
        to prevent perpetuating systemic inequities in future model versions.`,
    },
    {
      priority: "Medium",
      color: "#6366f1",
      action: "Extend to additional protected attributes",
      detail: `Current analysis covers ${protected_attributes.join(" and ")}. 
        Expand to disability status, age, socioeconomic background, and their intersections.`,
    },
    {
      priority: "Medium",
      color: "#6366f1",
      action: "Explore in-processing debiasing",
      detail: "IPW is a post-hoc technique. Adversarial debiasing or fairness constraints during training may achieve better joint fairness-utility tradeoffs.",
    },
    {
      priority: "Low",
      color: "#22c55e",
      action: "Document and disclose bias audit findings",
      detail: "Transparency about known limitations and mitigation efforts is both ethically important and increasingly required by regulation (EU AI Act, etc.).",
    },
  ];

  return (
    <div style={styles.wrap}>
      <SectionHeader
        title="Bias Explanation Panel"
        subtitle="Plain-language interpretation of fairness audit results for non-technical stakeholders"
      />

      {/* Severity banner */}
      <div style={{ ...styles.banner, borderColor: severityColor + "50", background: severityColor + "0d" }}>
        <div style={styles.bannerLeft}>
          <span style={{ color: severityColor, fontSize: 28, marginRight: 12 }}>
            {severity === "critical" ? "🚨" : severity === "high" ? "⚠️" : severity === "moderate" ? "⚡" : "✅"}
          </span>
          <div>
            <div style={{ ...styles.bannerTitle, color: severityColor }}>
              {severityLabel} BIAS LEVEL DETECTED
            </div>
            <div style={styles.bannerSub}>
              Pre-mitigation composite fairness score: {(fs * 100).toFixed(1)}% / 100%
            </div>
          </div>
        </div>
        <div style={styles.bannerRight}>
          <div style={styles.bannerMetrics}>
            <span>DPD: <strong style={{ color: severityColor }}>{(dpd * 100).toFixed(1)}pp</strong></span>
            <span>Flip: <strong style={{ color: severityColor }}>{(flipRate * 100).toFixed(1)}%</strong></span>
            <span>EOV: <strong style={{ color: severityColor }}>{(eov * 100).toFixed(1)}pp</strong></span>
          </div>
        </div>
      </div>

      {/* Findings */}
      <div style={styles.findingsGrid}>
        {findings.map(f => (
          <div key={f.title} style={{ ...styles.findingCard, borderColor: f.color + "30" }}>
            <div style={{ color: f.color, fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
            <h3 style={{ ...styles.findingTitle, color: f.color }}>{f.title}</h3>
            <p style={styles.findingBody}>{f.body}</p>
          </div>
        ))}
      </div>

      {/* What it means */}
      <div style={styles.analogyBox}>
        <div style={styles.analogyTitle}>🎓 What This Means in Practice</div>
        <div style={styles.analogyText}>
          Imagine {data.n_rows.toLocaleString()} job applications being scored by this AI system. 
          Under the original model, <strong style={{ color: "#ef4444" }}>{Math.round(before.instability.flip_rate * data.n_rows).toLocaleString()} applicants</strong> would 
          receive a different hiring decision if only their gender or race were different — not their 
          skills, experience, or education. That's direct algorithmic discrimination. After mitigation, 
          this drops to approximately <strong style={{ color: "#22c55e" }}>{Math.round(after.instability.flip_rate * data.n_rows).toLocaleString()} applicants</strong> — 
          a {comparison.flip_rate_reduction}% reduction in discriminatory decisions. However, complete 
          fairness was not achieved, and this system should not be deployed without further oversight.
        </div>
      </div>

      {/* Recommendations */}
      <div style={styles.recBox}>
        <h3 style={styles.recTitle}>Actionable Recommendations</h3>
        <div style={styles.recList}>
          {recommendations.map(r => (
            <div key={r.action} style={styles.recRow}>
              <span style={{ ...styles.recPriority, color: r.color, borderColor: r.color + "40", background: r.color + "10" }}>
                {r.priority}
              </span>
              <div>
                <div style={styles.recAction}>{r.action}</div>
                <div style={styles.recDetail}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 24 },
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid",
    borderRadius: 12,
    padding: "20px 24px",
    flexWrap: "wrap",
    gap: 16,
  },
  bannerLeft: { display: "flex", alignItems: "center" },
  bannerTitle: { fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 4 },
  bannerSub: { fontSize: 12, color: "#64748b", fontFamily: "system-ui, sans-serif" },
  bannerRight: {},
  bannerMetrics: { display: "flex", gap: 20, fontSize: 12, color: "#64748b", fontFamily: "monospace" },
  findingsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  findingCard: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid",
    borderRadius: 12,
    padding: 24,
  },
  findingTitle: { fontSize: 14, fontWeight: 700, margin: "0 0 10px", letterSpacing: "0.02em" },
  findingBody: { fontSize: 13, color: "#64748b", lineHeight: 1.75, margin: 0, fontFamily: "system-ui, sans-serif" },
  analogyBox: {
    background: "rgba(99,102,241,0.06)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 12,
    padding: 24,
  },
  analogyTitle: { fontSize: 14, fontWeight: 700, color: "#a5b4fc", marginBottom: 12 },
  analogyText: { fontSize: 14, color: "#64748b", lineHeight: 1.8, fontFamily: "system-ui, sans-serif" },
  recBox: {
    background: "rgba(15,23,42,0.7)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: 24,
  },
  recTitle: { margin: "0 0 20px", fontSize: 15, color: "#e2e8f0", fontWeight: 700 },
  recList: { display: "flex", flexDirection: "column", gap: 16 },
  recRow: { display: "flex", gap: 16, alignItems: "flex-start" },
  recPriority: {
    fontSize: 10,
    padding: "4px 10px",
    borderRadius: 20,
    border: "1px solid",
    letterSpacing: "0.1em",
    whiteSpace: "nowrap",
    marginTop: 2,
    flexShrink: 0,
  },
  recAction: { fontSize: 13, color: "#e2e8f0", fontWeight: 700, marginBottom: 4 },
  recDetail: { fontSize: 12, color: "#64748b", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" },
};
