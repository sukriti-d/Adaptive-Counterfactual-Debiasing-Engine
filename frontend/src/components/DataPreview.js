import React, { useState } from "react";
import { SectionHeader } from "./BiasOverview";

// ── Export helpers ────────────────────────────────────────────────────────────

/**
 * Build and trigger a browser download from a string blob.
 */
function triggerDownload(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Debiased CSV
 * ──────────────────
 * Reconstructs a CSV from the preview rows the backend already returned.
 * Adds two extra columns that are computed from the analysis result:
 *   • ipw_weight      — the per-row IPW weight computed by mitigator.py
 *                       (stored in data.after.bias_table → approximated here
 *                        from group-level positive-rate ratio; exact weights
 *                        live in the backend session, see api.py /export note)
 *   • acde_mitigated  — 1 if the model's post-mitigation prediction is positive
 *
 * Because the frontend only has aggregate statistics (not per-row predictions),
 * we annotate with group-level weights derived from the bias tables so the CSV
 * is still a valid drop-in sample_weight source for sklearn retraining.
 *
 * For exact per-row weights wire up GET /export/{session_id} in api.py (see
 * the Integration Note rendered below).
 */
function buildDebiasedCSV(data, previewRows, cols) {
  // Build a lookup: group label → positive_rate (after mitigation)
  const afterBiasMap = {};
  (data.after?.bias_table || []).forEach(row => {
    afterBiasMap[String(row.group).toLowerCase()] = row.positive_rate;
  });

  // Before positive rate for the whole dataset
  const beforeRate = data.before?.bias_table?.[0]?.positive_rate ?? 0.5;

  // Derive group col (first protected attr that exists in cols)
  const protectedAttr = (data.protected_attributes || []).find(a => cols.includes(a));

  const extraCols   = ["ipw_weight", "acde_mitigated"];
  const header      = [...cols, ...extraCols].join(",");

  const csvRows = previewRows.map(row => {
    // Approximate IPW weight: P(Y) / P(Y | group)
    const groupKey  = protectedAttr ? String(row[protectedAttr]).toLowerCase() : "";
    const groupRate = afterBiasMap[groupKey] ?? beforeRate;
    const ipwWeight = groupRate > 0
      ? Math.min(+(beforeRate / groupRate).toFixed(4), 5.0)
      : 1.0;

    // acde_mitigated: 1 if the mitigated positive rate for the group > 0.5
    const mitigated = groupRate > 0.5 ? 1 : 0;

    const values = cols.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return "";
      if (typeof v === "string" && v.includes(",")) return `"${v}"`;
      return v;
    });

    return [...values, ipwWeight, mitigated].join(",");
  });

  return [header, ...csvRows].join("\n");
}

/**
 * Export Audit Report
 * ───────────────────
 * Generates a structured plain-text compliance document containing:
 *   - Dataset summary
 *   - Before/After fairness metrics
 *   - Group disparity tables
 *   - Prioritised recommendations
 */
function buildAuditReport(data) {
  const ts    = new Date().toISOString();
  const line  = (char = "─", n = 68) => char.repeat(n);
  const pct   = v => (v * 100).toFixed(2) + "%";
  const fmt   = v => (typeof v === "number" ? v.toFixed(4) : String(v));

  const bm    = data.before?.metrics  || {};
  const am    = data.after?.metrics   || {};
  const bi    = data.before?.instability || {};
  const ai    = data.after?.instability  || {};
  const bp    = data.before?.performance || {};
  const ap    = data.after?.performance  || {};
  const comp  = data.comparison || {};

  const tableRow = (label, before, after, unit = "") =>
    `  ${label.padEnd(34)} ${String(before + unit).padStart(10)}   →   ${String(after + unit).padStart(10)}`;

  const groupTable = (biasTable = []) => {
    const hdr = "  Group".padEnd(20) + "N".padStart(8) + "  Pos Rate".padStart(12) + "  Disparity".padStart(13);
    const sep  = "  " + line("-", 52);
    const rows = biasTable.map(r =>
      "  " + String(r.group).padEnd(18) +
      String(r.n).padStart(8) +
      pct(r.positive_rate).padStart(12) +
      fmt(r.disparity).padStart(13)
    );
    return [hdr, sep, ...rows].join("\n");
  };

  const recommendations = [];
  if (am.demographic_parity_difference > 0.1)
    recommendations.push("HIGH   Demographic Parity Difference exceeds 0.10 — review group sampling or add reweighting epochs.");
  if (am.equalized_odds_violation > 0.1)
    recommendations.push("HIGH   Equalized Odds Violation exceeds 0.10 — consider post-processing threshold calibration.");
  if (am.disparate_impact_ratio < 0.8)
    recommendations.push("HIGH   Disparate Impact Ratio below 0.80 — fails the 4/5ths rule; legal review recommended.");
  if (ai.flip_rate > 0.15)
    recommendations.push("MEDIUM Counterfactual flip rate above 15% — model decisions are sensitive to protected attributes.");
  if (ai.idi > 0.15)
    recommendations.push("MEDIUM IDI score above 0.15 — significant probability shifts on attribute counterfactuals detected.");
  if (!recommendations.length)
    recommendations.push("LOW    All key metrics within acceptable thresholds post-mitigation. Schedule periodic re-audit.");

  return `
${line("═")}
  ACDE — Adaptive Counterfactual Debiasing Engine
  Bias Audit Report
  Generated: ${ts}
${line("═")}

DATASET SUMMARY
${line()}
  Total rows            : ${(data.n_rows || 0).toLocaleString()}
  Positive rate         : ${pct(data.positive_rate || 0)}
  Protected attributes  : ${(data.protected_attributes || []).join(", ")}


FAIRNESS METRICS — BEFORE vs AFTER MITIGATION
${line()}
${tableRow("Demographic Parity Diff.",    fmt(bm.demographic_parity_difference),  fmt(am.demographic_parity_difference))}
${tableRow("Equalized Odds Violation",    fmt(bm.equalized_odds_violation),        fmt(am.equalized_odds_violation))}
${tableRow("Predictive Parity Diff.",     fmt(bm.predictive_parity_difference),    fmt(am.predictive_parity_difference))}
${tableRow("Disparate Impact Ratio",      fmt(bm.disparate_impact_ratio),          fmt(am.disparate_impact_ratio))}
${tableRow("Counterfactual Flip Rate",    pct(bi.flip_rate || 0),                 pct(ai.flip_rate || 0))}
${tableRow("IDI Score",                   fmt(bi.idi || 0),                        fmt(ai.idi || 0))}
${tableRow("Composite Fairness Score",    pct(data.before?.fairness_score || 0),   pct(data.after?.fairness_score || 0))}
${tableRow("Fairness Gain",              "",                                       "+" + pct(comp.fairness_gain || 0))}


MODEL PERFORMANCE — BEFORE vs AFTER MITIGATION
${line()}
${tableRow("Accuracy",          fmt(bp.accuracy),  fmt(ap.accuracy))}
${tableRow("Balanced Accuracy", fmt(bp.balanced),  fmt(ap.balanced))}
${tableRow("F1 Score",          fmt(bp.f1),        fmt(ap.f1))}
${tableRow("ROC-AUC",           fmt(bp.roc_auc),   fmt(ap.roc_auc))}
${tableRow("Accuracy Δ (loss)", "",                fmt(comp.accuracy_loss || 0))}


GROUP DISPARITY TABLE — BEFORE MITIGATION
${line()}
${groupTable(data.before?.bias_table)}


GROUP DISPARITY TABLE — AFTER MITIGATION
${line()}
${groupTable(data.after?.bias_table)}


PRIORITISED RECOMMENDATIONS
${line()}
${recommendations.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}


INTEGRATION NOTE
${line()}
  The ipw_weight column in the debiased CSV export is derived from group-level
  positive-rate ratios. For exact per-row weights from the backend session, add
  the following endpoint to api.py:

    from fastapi.responses import StreamingResponse

    @app.get("/export/{session_id}")
    def export_debiased(session_id: str):
        if session_id not in SESSIONS:
            raise HTTPException(status_code=404, detail="Session not found.")
        result = SESSIONS[session_id].get("result", {})
        df_w   = SESSIONS[session_id]["df"].copy()
        # ipw_weight is stored on df_w after apply_reweighting()
        # Re-run mitigator if needed:
        # from mitigator import apply_reweighting
        # df_w = apply_reweighting(df_w, bias_df, group_cols=result["protected_attributes"])
        csv_bytes = df_w.to_csv(index=False).encode()
        return StreamingResponse(
            iter([csv_bytes]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=acde_debiased.csv"}
        )

${line("═")}
  END OF REPORT — ACDE v2.0.0
${line("═")}
`.trimStart();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataPreview({ data, sessionId }) {
  const [showAll, setShowAll]           = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const [rptExporting, setRptExporting] = useState(false);

  const rows = showAll ? data.preview : data.preview?.slice(0, 5);
  const cols = data.columns || [];

  const handleExportCSV = async () => {
    setCsvExporting(true);
    try {
      if (!sessionId) {
        alert("Session ID not found. Please upload data again.");
        return;
      }
      const response = await fetch(`http://localhost:8000/export/${sessionId}`);
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "debiased_dataset.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error exporting CSV: " + e.message);
    } finally {
      setCsvExporting(false);
    }
  };

  const handleExportReport = () => {
    setRptExporting(true);
    try {
      const report = buildAuditReport(data);
      triggerDownload(report, "acde_bias_audit_report.txt", "text/plain");
    } finally {
      setRptExporting(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <SectionHeader
        title="Dataset Preview"
        subtitle={`${data.n_rows?.toLocaleString()} rows · ${cols.length} columns · ${(data.positive_rate * 100).toFixed(1)}% positive rate · Protected: ${data.protected_attributes?.join(", ")}`}
      />

      {/* Stats */}
      <div style={styles.statsRow}>
        <Stat label="Total Rows"      value={data.n_rows?.toLocaleString()} />
        <Stat label="Features"        value={(cols.length - 1).toString()} />
        <Stat label="Positive Rate"   value={(data.positive_rate * 100).toFixed(1) + "%"} />
        <Stat label="Protected Attrs" value={data.protected_attributes?.join(" + ")} />
      </div>

      {/* ── EXPORT BUTTONS ── */}
      {data.before && data.after && (
        <div style={styles.exportBox}>
          <div style={styles.exportTitle}>⬇ Export Debiased Data</div>
          <div style={styles.exportDesc}>
            Download the dataset annotated with IPW weights (drop-in{" "}
            <code style={styles.code}>sample_weight</code> for sklearn retraining) and a
            full audit report for compliance documentation.
          </div>
          <div style={styles.exportBtns}>
            <button
              style={{ ...styles.exportBtn, ...styles.exportBtnGreen }}
              onClick={handleExportCSV}
              disabled={csvExporting}
            >
              {csvExporting ? "Generating…" : "⬇ Export Debiased CSV"}
            </button>
            <button
              style={{ ...styles.exportBtn, ...styles.exportBtnBlue }}
              onClick={handleExportReport}
              disabled={rptExporting}
            >
              {rptExporting ? "Generating…" : "⬇ Export Audit Report"}
            </button>
          </div>
          <div style={styles.exportNote}>
            CSV columns: all original features +{" "}
            <code style={styles.code}>ipw_weight</code>,{" "}
            <code style={styles.code}>acde_mitigated</code>. Wire{" "}
            <code style={styles.code}>GET /export/&#123;session_id&#125;</code> in api.py
            for exact per-row backend weights (see Audit Report → Integration Note).
          </div>
        </div>
      )}

      {/* Column types */}
      <div style={styles.colBox}>
        <h3 style={styles.boxTitle}>Column Schema</h3>
        <div style={styles.colGrid}>
          {cols.map(col => (
            <div key={col} style={styles.colItem}>
              <div style={styles.colName}>{col}</div>
              <div style={styles.colRole}>
                {col === "target" ? "🎯 Target"
                  : data.protected_attributes?.includes(col) ? "🔒 Protected"
                  : "📊 Feature"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Group rates */}
      {data.group_rates && (
        <div style={styles.colBox}>
          <h3 style={styles.boxTitle}>Positive Rate by {data.protected_attributes?.[0]}</h3>
          <div style={styles.rateList}>
            {Object.entries(data.group_rates).map(([group, rate]) => (
              <div key={group} style={styles.rateRow}>
                <span style={styles.rateGroup}>{group}</span>
                <div style={styles.rateBar}>
                  <div style={{
                    ...styles.rateFill,
                    width: (rate * 100) + "%",
                    background: rate > 0.5 ? "#6366f1" : rate > 0.3 ? "#f59e0b" : "#ef4444"
                  }} />
                </div>
                <span style={styles.ratePct}>{(rate * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data table */}
      {rows && rows.length > 0 && (
        <div style={styles.tableBox}>
          <div style={styles.tableHeader}>
            <h3 style={styles.boxTitle}>Data Preview</h3>
            <button style={styles.toggleBtn} onClick={() => setShowAll(v => !v)}>
              {showAll ? "Show Less" : "Show All 10 Rows"}
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {cols.map(col => (
                    <th key={col} style={{
                      ...styles.th,
                      color: col === "target" ? "#22c55e"
                        : data.protected_attributes?.includes(col) ? "#a855f7"
                        : "#6366f1"
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(99,102,241,0.06)" }}>
                    {cols.map(col => (
                      <td key={col} style={{
                        ...styles.td,
                        color: col === "target" ? (row[col] === 1 ? "#22c55e" : "#ef4444")
                          : data.protected_attributes?.includes(col) ? "#c084fc"
                          : "#94a3b8"
                      }}>
                        {typeof row[col] === "number"
                          ? (Number.isInteger(row[col]) ? row[col] : row[col].toFixed(4))
                          : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data privacy note */}
      <div style={styles.privacyBox}>
        <span style={styles.privacyIcon}>🔒</span>
        <div>
          <div style={styles.privacyTitle}>Data Privacy</div>
          <div style={styles.privacyText}>
            Uploaded data is processed in-memory only and never persisted to disk. Sessions are cleared automatically.
            No raw data is exposed through the API or stored externally. ACDE operates on aggregate statistics only after initial processing.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles = {
  wrap:       { display: "flex", flexDirection: "column", gap: 20 },
  statsRow:   { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  statCard: {
    background:   "rgba(15,23,42,0.7)",
    border:       "1px solid rgba(99,102,241,0.12)",
    borderRadius: 10,
    padding:      "16px 16px",
  },
  statLabel:  { fontSize: 9, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 },
  statValue:  { fontSize: 18, fontWeight: 800, color: "#e2e8f0" },

  // ── Export box ──
  exportBox: {
    background:   "rgba(15,23,42,0.8)",
    border:       "1px solid rgba(34,197,94,0.25)",
    borderRadius: 12,
    padding:      "20px 24px",
  },
  exportTitle: { fontSize: 13, fontWeight: 700, color: "#4ade80", marginBottom: 8, letterSpacing: "0.04em" },
  exportDesc:  { fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginBottom: 16, fontFamily: "system-ui, sans-serif" },
  exportBtns:  { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  exportBtn: {
    fontSize:     12,
    fontWeight:   700,
    padding:      "10px 20px",
    borderRadius: 8,
    border:       "none",
    cursor:       "pointer",
    fontFamily:   "IBM Plex Mono, monospace",
    letterSpacing: "0.04em",
    transition:   "opacity 0.15s",
  },
  exportBtnGreen: { background: "#22c55e", color: "#0f172a" },
  exportBtnBlue:  { background: "#6366f1", color: "#ffffff" },
  exportNote: {
    fontSize:     11,
    color:        "#475569",
    lineHeight:   1.6,
    fontFamily:   "system-ui, sans-serif",
  },
  code: {
    background:   "rgba(99,102,241,0.12)",
    color:        "#a5b4fc",
    padding:      "1px 5px",
    borderRadius: 4,
    fontFamily:   "IBM Plex Mono, monospace",
    fontSize:     11,
  },

  colBox: {
    background:   "rgba(15,23,42,0.7)",
    border:       "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding:      20,
  },
  boxTitle:   { margin: "0 0 16px", fontSize: 13, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.06em" },
  colGrid:    { display: "flex", flexWrap: "wrap", gap: 8 },
  colItem: {
    background:   "rgba(99,102,241,0.06)",
    border:       "1px solid rgba(99,102,241,0.15)",
    borderRadius: 8,
    padding:      "8px 12px",
    display:      "flex",
    flexDirection: "column",
    gap:          4,
  },
  colName:    { fontSize: 12, color: "#e2e8f0", fontWeight: 600 },
  colRole:    { fontSize: 10, color: "#64748b" },
  rateList:   { display: "flex", flexDirection: "column", gap: 10 },
  rateRow:    { display: "flex", alignItems: "center", gap: 12 },
  rateGroup:  { fontSize: 12, color: "#e2e8f0", width: 80, flexShrink: 0 },
  rateBar:    { flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" },
  rateFill:   { height: "100%", borderRadius: 4, transition: "width 0.5s" },
  ratePct:    { fontSize: 12, color: "#94a3b8", width: 44, textAlign: "right" },
  tableBox: {
    background:   "rgba(15,23,42,0.7)",
    border:       "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding:      20,
  },
  tableHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  toggleBtn: {
    fontSize:   11,
    padding:    "5px 12px",
    borderRadius: 6,
    border:     "1px solid rgba(99,102,241,0.25)",
    background: "transparent",
    color:      "#6366f1",
    cursor:     "pointer",
    fontFamily: "inherit",
  },
  table:      { width: "100%", borderCollapse: "collapse", minWidth: 600 },
  th: {
    fontSize:     10,
    letterSpacing: "0.1em",
    textAlign:    "left",
    padding:      "8px 12px",
    borderBottom: "1px solid rgba(99,102,241,0.15)",
    fontWeight:   600,
  },
  td: {
    fontSize: 12,
    padding:  "10px 12px",
    borderBottom: "1px solid rgba(99,102,241,0.05)",
  },
  privacyBox: {
    display:      "flex",
    gap:          16,
    background:   "rgba(34,197,94,0.06)",
    border:       "1px solid rgba(34,197,94,0.2)",
    borderRadius: 10,
    padding:      16,
  },
  privacyIcon:  { fontSize: 24, flexShrink: 0 },
  privacyTitle: { fontSize: 12, fontWeight: 700, color: "#22c55e", marginBottom: 6 },
  privacyText:  { fontSize: 12, color: "#64748b", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" },
};