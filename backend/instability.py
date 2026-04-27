"""
instability.py  –  ACDE Counterfactual Instability Metrics
=======================================================================
Measures how sensitive a model's predictions are to changes in protected
attributes.  A perfectly fair model would show 0 % instability.

Metrics exposed
───────────────
• instability_rate   – fraction of rows whose prediction flips
• flip_breakdown     – per-(original_pred → cf_pred) transition counts
• group_instability  – instability rate per demographic subgroup
• idi_score          – Individual Discrimination Index:
                         average |P(ŷ=1|x) − P(ŷ=1|x_cf)| over all rows
                         (requires predicted probabilities)
"""

import numpy as np
import pandas as pd
from typing import Optional, Tuple, Dict


def calculate_instability(
    pred_original: np.ndarray,
    pred_cf: np.ndarray,
) -> Tuple[float, np.ndarray]:
    """
    Returns
    -------
    instability_rate : float  – fraction [0,1] of flipped predictions
    changes          : bool array  – True where prediction changed
    """
    pred_original = np.asarray(pred_original)
    pred_cf       = np.asarray(pred_cf)
    changes = pred_original != pred_cf
    return float(changes.mean()), changes.astype(bool)


def flip_breakdown(
    pred_original: np.ndarray,
    pred_cf: np.ndarray,
) -> Dict[str, int]:
    """
    Count the four possible (original → cf) transitions:
        0→0, 0→1, 1→0, 1→1
    The 0→1 and 1→0 cells reveal *direction* of discrimination.
    """
    p = np.asarray(pred_original)
    c = np.asarray(pred_cf)
    return {
        "stable_neg":    int(((p == 0) & (c == 0)).sum()),
        "neg_to_pos":    int(((p == 0) & (c == 1)).sum()),   # gaining positive outcome when flipped
        "pos_to_neg":    int(((p == 1) & (c == 0)).sum()),   # losing positive outcome when flipped
        "stable_pos":    int(((p == 1) & (c == 1)).sum()),
    }


def group_instability(
    df: pd.DataFrame,
    pred_original: np.ndarray,
    pred_cf: np.ndarray,
    group_cols: list,
) -> pd.DataFrame:
    """
    Compute instability rate broken down by demographic subgroup.

    Returns a DataFrame with columns: group, n, instability_rate, neg_to_pos, pos_to_neg
    """
    df = df.copy()
    df["_orig"] = pred_original
    df["_cf"]   = pred_cf
    df["_flip"] = (df["_orig"] != df["_cf"]).astype(int)
    df["_n2p"]  = ((df["_orig"] == 0) & (df["_cf"] == 1)).astype(int)
    df["_p2n"]  = ((df["_orig"] == 1) & (df["_cf"] == 0)).astype(int)

    rows = []
    for keys, grp in df.groupby(group_cols):
        label = " / ".join(str(k) for k in (keys if isinstance(keys, tuple) else [keys]))
        rows.append({
            "group":            label,
            "n":                len(grp),
            "instability_rate": round(grp["_flip"].mean(), 4),
            "neg_to_pos":       grp["_n2p"].sum(),
            "pos_to_neg":       grp["_p2n"].sum(),
        })

    return pd.DataFrame(rows).sort_values("instability_rate", ascending=False)


def idi_score(
    prob_original: np.ndarray,
    prob_cf: np.ndarray,
) -> float:
    """
    Individual Discrimination Index: mean absolute probability shift.
    Ranges [0, 1]; lower is more stable.
    """
    return float(np.abs(np.asarray(prob_original) - np.asarray(prob_cf)).mean())