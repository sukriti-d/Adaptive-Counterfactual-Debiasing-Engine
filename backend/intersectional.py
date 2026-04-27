"""
intersectional.py  –  ACDE Intersectional Bias Metrics
=======================================================================
Computes a rich set of group-fairness metrics:

  • Demographic Parity Difference (DPD)
      |P(ŷ=1|A=a) − P(ŷ=1|A=b)|  for every pair of groups

  • Equalized Odds Violation
      max over {TPR, FPR} of the largest inter-group gap

  • Predictive Parity Difference
      |Precision_a − Precision_b|

  • Per-group summary table (used for reweighting and reporting)

All metrics are computed intersectionally (gender × race × …) so that
compounding disadvantages are not masked by marginal statistics.
"""

import numpy as np
import pandas as pd
from itertools import combinations
from typing import List, Tuple


# ──────────────────────────────────────────────────────────────────────────────
# Core group-level table
# ──────────────────────────────────────────────────────────────────────────────

def intersectional_bias(
    df: pd.DataFrame,
    preds: np.ndarray,
    group_cols: List[str] = None,
) -> pd.DataFrame:
    """
    Build a per-group fairness summary.

    Columns returned
    ────────────────
    group, n, positive_rate, disparity, tpr, fpr, precision
    """
    if group_cols is None:
        group_cols = [c for c in ["gender", "race"] if c in df.columns]

    df = df.copy()
    df["_pred"] = preds.astype(int)
    df["_true"] = df["target"].astype(int)

    overall_rate = df["_pred"].mean()

    rows = []
    for keys, grp in df.groupby(group_cols):
        label = " / ".join(str(k) for k in (keys if isinstance(keys, tuple) else [keys]))
        n      = len(grp)
        pos_r  = grp["_pred"].mean()

        # TPR / FPR (equalized odds)
        pos_mask = grp["_true"] == 1
        neg_mask = grp["_true"] == 0
        tpr = grp.loc[pos_mask, "_pred"].mean() if pos_mask.any() else np.nan
        fpr = grp.loc[neg_mask, "_pred"].mean() if neg_mask.any() else np.nan

        # Precision
        pred_pos = grp["_pred"] == 1
        precision = (
            grp.loc[pred_pos, "_true"].mean()
            if pred_pos.any() else np.nan
        )

        rows.append({
            "group":         label,
            "n":             n,
            "positive_rate": round(pos_r, 4),
            "disparity":     round(abs(pos_r - overall_rate), 4),
            "tpr":           round(tpr, 4) if not np.isnan(tpr) else np.nan,
            "fpr":           round(fpr, 4) if not np.isnan(fpr) else np.nan,
            "precision":     round(precision, 4) if not np.isnan(precision) else np.nan,
        })

    result = pd.DataFrame(rows).sort_values("disparity", ascending=False)
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Scalar fairness violation metrics
# ──────────────────────────────────────────────────────────────────────────────

def demographic_parity_difference(bias_df: pd.DataFrame) -> float:
    """Max pairwise positive-rate gap across all groups."""
    rates = bias_df["positive_rate"].dropna()
    return float(rates.max() - rates.min())


def equalized_odds_violation(bias_df: pd.DataFrame) -> float:
    """Max of (TPR gap, FPR gap) across all groups."""
    tpr_gap = bias_df["tpr"].dropna().max() - bias_df["tpr"].dropna().min()
    fpr_gap = bias_df["fpr"].dropna().max() - bias_df["fpr"].dropna().min()
    return float(max(tpr_gap, fpr_gap))


def predictive_parity_difference(bias_df: pd.DataFrame) -> float:
    """Max pairwise precision gap."""
    prec = bias_df["precision"].dropna()
    return float(prec.max() - prec.min())


def disparate_impact_ratio(bias_df: pd.DataFrame) -> float:
    """
    min_group_rate / max_group_rate.
    A value < 0.80 is the classic 4/5ths-rule threshold for disparate impact.
    """
    rates = bias_df["positive_rate"].replace(0, np.nan).dropna()
    if rates.empty:
        return np.nan
    return float(rates.min() / rates.max())


def all_metrics(bias_df: pd.DataFrame) -> dict:
    return {
        "demographic_parity_difference": round(demographic_parity_difference(bias_df), 4),
        "equalized_odds_violation":      round(equalized_odds_violation(bias_df), 4),
        "predictive_parity_difference":  round(predictive_parity_difference(bias_df), 4),
        "disparate_impact_ratio":        round(disparate_impact_ratio(bias_df), 4),
    }