import React, { useRef, useState } from "react";

export default function UploadScreen({ onDemo, onUpload, loading, error }) {
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (f && f.name.endsWith(".csv")) onUpload(f);
  };

  return (
    <div style={styles.page}>
      {/* Animated background grid */}
      <div style={styles.grid} />
      <div style={styles.glow1} />
      <div style={styles.glow2} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.badge}>FAIRNESS AUDIT</div>
        <h1 style={styles.title}>
          <span style={styles.acde}>ACDE</span>
        </h1>
        <p style={styles.subtitle}>Adaptive Counterfactual Debiasing Engine</p>
        <p style={styles.desc}>
          Detect, measure, and mitigate bias in AI decision systems using
          intersectional fairness analysis and counterfactual sensitivity testing.
        </p>

        {/* Feature pills */}
        <div style={styles.pills}>
          {["Intersectional Bias", "Counterfactual Analysis", "IPW Mitigation", "Fairness Metrics"].map(f => (
            <span key={f} style={styles.pill}>{f}</span>
          ))}
        </div>

        {/* Upload zone */}
        <div
          style={{ ...styles.dropzone, ...(dragging ? styles.dropzoneActive : {}) }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])}
          />
          <div style={styles.uploadIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p style={styles.dropTitle}>Drop your CSV dataset here</p>
          <p style={styles.dropSub}>Must include a <code style={styles.code}>target</code> column (0/1 binary outcome)</p>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} /><span style={styles.dividerText}>OR</span><span style={styles.dividerLine} />
        </div>

        {/* Demo button */}
        <button
          style={{ ...styles.demoBtn, ...(loading ? styles.demoBtnDisabled : {}) }}
          onClick={onDemo}
          disabled={loading}
        >
          {loading ? (
            <span style={styles.loadingRow}>
              <span style={styles.spinner} />
              Running ACDE Pipeline...
            </span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Demo with Synthetic Biased Dataset
            </>
          )}
        </button>

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Info cards */}
        <div style={styles.cards}>
          {[
            {
              icon: "⚡",
              title: "Counterfactual Testing",
              desc: "Flips protected attributes and measures prediction instability to detect hidden discrimination."
            },
            {
              icon: "🔍",
              title: "Intersectional Bias",
              desc: "Analyzes compounded disadvantages across gender × race × other attribute combinations."
            },
            {
              icon: "⚖️",
              title: "IPW Mitigation",
              desc: "Applies Inverse Probability Weighting with iterative disparity correction to reduce bias."
            },
          ].map(card => (
            <div key={card.title} style={styles.card}>
              <div style={styles.cardIcon}>{card.icon}</div>
              <h3 style={styles.cardTitle}>{card.title}</h3>
              <p style={styles.cardDesc}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'IBM Plex Mono', 'Fira Code', 'Consolas', monospace",
    position: "relative",
    overflow: "hidden",
    padding: "40px 20px",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: "linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
    pointerEvents: "none",
  },
  glow1: {
    position: "fixed",
    top: "-200px",
    left: "-200px",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  glow2: {
    position: "fixed",
    bottom: "-200px",
    right: "-200px",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  container: {
    maxWidth: 720,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  badge: {
    fontSize: 11,
    letterSpacing: "0.2em",
    color: "#6366f1",
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.3)",
    borderRadius: 4,
    padding: "4px 12px",
    marginBottom: 24,
    textTransform: "uppercase",
  },
  title: {
    margin: "0 0 8px",
    fontSize: 80,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    lineHeight: 1,
  },
  acde: {
    background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    fontSize: 18,
    color: "#94a3b8",
    margin: "0 0 16px",
    letterSpacing: "0.05em",
    fontWeight: 400,
  },
  desc: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 520,
    lineHeight: 1.7,
    margin: "0 0 24px",
    fontFamily: "system-ui, sans-serif",
  },
  pills: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 40,
  },
  pill: {
    fontSize: 11,
    letterSpacing: "0.1em",
    color: "#7c3aed",
    background: "rgba(124,58,237,0.1)",
    border: "1px solid rgba(124,58,237,0.25)",
    borderRadius: 20,
    padding: "4px 12px",
  },
  dropzone: {
    width: "100%",
    border: "2px dashed rgba(99,102,241,0.3)",
    borderRadius: 16,
    padding: "48px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    background: "rgba(99,102,241,0.03)",
    boxSizing: "border-box",
  },
  dropzoneActive: {
    border: "2px dashed #6366f1",
    background: "rgba(99,102,241,0.08)",
  },
  uploadIcon: {
    color: "#6366f1",
    marginBottom: 16,
    opacity: 0.7,
  },
  dropTitle: {
    fontSize: 18,
    color: "#e2e8f0",
    margin: "0 0 8px",
    fontWeight: 600,
  },
  dropSub: {
    fontSize: 13,
    color: "#64748b",
    margin: 0,
    fontFamily: "system-ui, sans-serif",
  },
  code: {
    background: "rgba(99,102,241,0.2)",
    padding: "1px 6px",
    borderRadius: 3,
    fontSize: 12,
    color: "#a5b4fc",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    margin: "28px 0",
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "rgba(99,102,241,0.15)",
  },
  dividerText: {
    fontSize: 12,
    color: "#475569",
    letterSpacing: "0.1em",
  },
  demoBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "16px 32px",
    fontSize: 15,
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 600,
    letterSpacing: "0.02em",
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s, transform 0.2s",
    boxShadow: "0 0 32px rgba(99,102,241,0.3)",
  },
  demoBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    display: "inline-block",
    width: 16,
    height: 16,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  error: {
    marginTop: 16,
    padding: "12px 16px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 8,
    color: "#fca5a5",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginTop: 48,
    width: "100%",
  },
  card: {
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(99,102,241,0.12)",
    borderRadius: 12,
    padding: "24px 20px",
  },
  cardIcon: { fontSize: 28, marginBottom: 12 },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: 13,
    color: "#e2e8f0",
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  cardDesc: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.6,
    fontFamily: "system-ui, sans-serif",
  },
};
