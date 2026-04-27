"""
mitigator.py  –  ACDE Bias Mitigation via Adaptive Reweighting
=======================================================================
Strategy
─────────
1. **Inverse Probability Weighting (IPW)**
   Each sample is re-weighted by the inverse of the probability that it
   belongs to its demographic group × outcome cell.  This upweights
   underrepresented (group, outcome) cells and downweights over-
   represented ones, pushing the model towards demographic parity.

2. **Iterative Disparity-Penalised Reweighting**
   After the initial IPW pass we check whether residual disparity
   remains, and amplify weights for the still-disadvantaged groups
   with a dampened correction factor.  We iterate until disparity
   drops below a tolerance or we exhaust a maximum number of rounds.

3. **Clipping**
   Very large weights destabilise training.  We clip at the 95th
   percentile to prevent a handful of samples from dominating the
   gradient updates.

The function returns the original DataFrame with a new 'weight' column
(no rows are dropped, so downstream code sees the same schema).
"""

import numpy as np
import pandas as pd
from typing import List, Optional


WEIGHT_COL   = "weight"
TARGET_COL   = "target"
MAX_ITER     = 10
DISP_TOL     = 0.02     # stop iterating once max disparity < this value
DAMP         = 0.60     # dampening factor in [0,1] for stability
CLIP_QUANTILE = 0.95    # clip extreme weights at this quantile


# ──────────────────────────────────────────────────────────────────────────────
# Step 1 – Inverse Probability Weighting
# ──────────────────────────────────────────────────────────────────────────────

def _ipw_weights(
    df: pd.DataFrame,
    group_cols: List[str],
) -> np.ndarray:
    """
    Compute IPW weights.

    For each row:   w_i = P(Y) / P(Y | G)
    where G is the demographic group and Y is the binary target.
    """
    df = df.copy()
    p_y1 = df[TARGET_COL].mean()
    p_y0 = 1.0 - p_y1

    weights = np.ones(len(df))

    for keys, grp_idx in df.groupby(group_cols).groups.items():
        grp = df.loc[grp_idx]
        p_y1_g = grp[TARGET_COL].mean()
        p_y0_g = 1.0 - p_y1_g

        for idx in grp_idx:
            y = df.loc[idx, TARGET_COL]
            p_y_g = p_y1_g if y == 1 else p_y0_g
            p_y   = p_y1   if y == 1 else p_y0
            if p_y_g > 0:
                weights[df.index.get_loc(idx)] = p_y / p_y_g
            # else leave at 1.0

    return weights


# ──────────────────────────────────────────────────────────────────────────────
# Step 2 – Iterative Disparity Correction
# ──────────────────────────────────────────────────────────────────────────────

def _disparity_correction(
    df: pd.DataFrame,
    weights: np.ndarray,
    group_cols: List[str],
    n_iter: int = MAX_ITER,
    tol: float = DISP_TOL,
    damp: float = DAMP,
) -> np.ndarray:
    """
    Iteratively amplify weights for disadvantaged (low positive-rate) groups
    until disparity falls below *tol* or *n_iter* rounds are exhausted.
    """
    df = df.copy()
    df["_w"] = weights

    for _round in range(n_iter):
        # Compute weighted positive rates per group
        group_rates = {}
        for keys, grp_idx in df.groupby(group_cols).groups.items():
            grp = df.loc[grp_idx]
            # Weighted mean of target
            w = grp["_w"].values
            y = grp[TARGET_COL].values
            r = np.average(y, weights=w) if w.sum() > 0 else y.mean()
            label = keys if isinstance(keys, str) else " / ".join(str(k) for k in keys)
            group_rates[label] = r

        rates = list(group_rates.values())
        max_r  = max(rates)
        min_r  = min(rates)
        disparity = max_r - min_r

        if disparity < tol:
            break

        overall = df["_w"].values @ df[TARGET_COL].values / df["_w"].sum()

        # Boost underrepresented groups, gently lower over-represented ones
        for keys, grp_idx in df.groupby(group_cols).groups.items():
            label = keys if isinstance(keys, str) else " / ".join(str(k) for k in keys)
            r = group_rates[label]
            if overall > 0 and r > 0:
                correction = (overall / r) ** damp
            elif r == 0:
                correction = 1.0 + damp
            else:
                correction = 1.0
            df.loc[grp_idx, "_w"] *= correction

        # Re-normalise after each round
        df["_w"] /= df["_w"].mean()

    return df["_w"].values


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def apply_reweighting(
    df: pd.DataFrame,
    bias_df: pd.DataFrame,
    group_cols: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Full reweighting pipeline: IPW → iterative disparity correction → clip.

    Returns the input DataFrame with a 'weight' column added (or replaced).
    """
    df = df.copy().reset_index(drop=True)

    if group_cols is None:
        group_cols = [c for c in ["gender", "race"] if c in df.columns]

    # ── Step 1: IPW ──
    weights = _ipw_weights(df, group_cols)

    # ── Step 2: Iterative disparity correction ──
    weights = _disparity_correction(df, weights, group_cols)

    # ── Step 3: Clip extreme weights ──
    clip_val = np.quantile(weights, CLIP_QUANTILE)
    weights  = np.clip(weights, 0.1, clip_val)

    # ── Step 4: Final normalisation (mean = 1) ──
    weights /= weights.mean()

    df[WEIGHT_COL] = weights

    return df


def debias_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Placeholder for future in-processing or pre-processing debiasing
    (e.g. resampling, latent-variable disentanglement).  Currently a
    no-op that returns df unchanged; weights are the active mechanism.
    """
    return df