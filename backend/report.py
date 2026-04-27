"""
report.py  –  ACDE Fairness Audit Report Generator
=======================================================================
Produces both a text summary (for terminal / logs) and structured dicts
(for downstream dashboards, tests, or export).

Composite Fairness Score
────────────────────────
  F = 1 − [α·DPD + β·EOV + γ·IDI]

  where
    DPD = Demographic Parity Difference          (0 = perfect parity)
    EOV = Equalized Odds Violation               (0 = perfect EOV)
    IDI = Individual Discrimination Index        (0 = no instability)
    α, β, γ are configurable weights (default 0.4, 0.4, 0.2)

  F ∈ [0,1]; higher is fairer.
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Optional


# Composite score weights  (must sum to 1)
ALPHA = 0.40   # demographic parity
BETA  = 0.40   # equalized odds
GAMMA = 0.20   # individual instability (IDI)


# ──────────────────────────────────────────────────────────────────────────────
# Scalar score
# ──────────────────────────────────────────────────────────────────────────────

def fairness_score(
    instability: float,
    bias_df: pd.DataFrame,
    idi: Optional[float] = None,
) -> float:
    """
    Composite fairness score ∈ [0,1].  Higher = fairer.

    If *idi* (Individual Discrimination Index) is not supplied,
    instability_rate is used as a proxy.
    """
    dpd = float(bias_df["disparity"].max())

    # Equalized odds: max gap in TPR and FPR across groups
    tpr_gap = (bias_df["tpr"].dropna().max() - bias_df["tpr"].dropna().min()
               if "tpr" in bias_df.columns else 0.0)
    fpr_gap = (bias_df["fpr"].dropna().max() - bias_df["fpr"].dropna().min()
               if "fpr" in bias_df.columns else 0.0)
    eov = float(max(tpr_gap, fpr_gap))

    idi_val = float(idi) if idi is not None else float(instability)

    raw = ALPHA * dpd + BETA * eov + GAMMA * idi_val
    score = max(0.0, 1.0 - raw)
    return round(score, 4)


# ──────────────────────────────────────────────────────────────────────────────
# Text report
# ──────────────────────────────────────────────────────────────────────────────

def generate_report(
    instability: float,
    bias_df: pd.DataFrame,
    metrics: Optional[dict] = None,
    phase: str = "AUDIT",
    idi: Optional[float] = None,
) -> str:
    """
    Return a multi-line text report suitable for terminal output or logging.
    """
    w = 68
    lines = [
        "=" * w,
        f"  ACDE FAIRNESS AUDIT REPORT  –  {phase}",
        f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * w,
        "",
        "  INSTABILITY (Counterfactual Sensitivity)",
        f"    Flip Rate  : {instability:.4f}  "
        f"({'HIGH' if instability > 0.40 else 'MODERATE' if instability > 0.20 else 'LOW'})",
    ]

    if idi is not None:
        lines.append(f"    IDI Score  : {idi:.4f}  (mean |ΔP(ŷ=1)| per flip)")

    lines += [
        "",
        "  INTERSECTIONAL BIAS TABLE",
        f"  {'Group':<22} {'n':>6} {'Pos.Rate':>10} {'Disparity':>10} "
        f"{'TPR':>7} {'FPR':>7} {'Precision':>10}",
        "  " + "-" * (w - 2),
    ]

    for _, row in bias_df.iterrows():
        tpr = f"{row['tpr']:.3f}" if "tpr" in row and not pd.isna(row["tpr"]) else "  N/A"
        fpr = f"{row['fpr']:.3f}" if "fpr" in row and not pd.isna(row["fpr"]) else "  N/A"
        pre = f"{row['precision']:.3f}" if "precision" in row and not pd.isna(row["precision"]) else "      N/A"
        lines.append(
            f"  {str(row['group']):<22} {int(row['n']):>6} "
            f"{row['positive_rate']:>10.4f} {row['disparity']:>10.4f} "
            f"{tpr:>7} {fpr:>7} {pre:>10}"
        )

    if metrics:
        dir_val = metrics.get('disparate_impact_ratio', None)
        dir_note = ""
        if dir_val is not None and not (isinstance(dir_val, float) and dir_val != dir_val):
            if dir_val >= 0.80:
                dir_note = " ✓ meets 4/5ths rule"
            elif dir_val >= 0.50:
                dir_note = " — significant improvement; structural imbalance remains"
            else:
                dir_note = " — below threshold; structural imbalance remains"

        lines += [
            "",
            "  SCALAR FAIRNESS METRICS",
            f"    Demographic Parity Diff  : {metrics.get('demographic_parity_difference', 'N/A')}",
            f"    Equalized Odds Violation : {metrics.get('equalized_odds_violation', 'N/A')}",
            f"    Predictive Parity Diff   : {metrics.get('predictive_parity_difference', 'N/A')}",
            f"    Disparate Impact Ratio   : {metrics.get('disparate_impact_ratio', 'N/A')}"
            f"  (< 0.80 = disparate impact threshold{dir_note})",
        ]

    fs = fairness_score(instability, bias_df, idi)
    lines += [
        "",
        f"  COMPOSITE FAIRNESS SCORE  :  {fs:.4f} / 1.0000",
        "  (1.0 = perfectly fair; computed as 1 − [0.4·DPD + 0.4·EOV + 0.2·IDI])",
        "",
        "=" * w,
    ]
    return "\n".join(lines)