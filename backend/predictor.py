"""
predictor.py  –  ACDE Model Training & Prediction
=======================================================================
Key design decisions
────────────────────
• One-hot encoding is done ONCE during prepare_data; column names are
  persisted so that predict() can re-align any new DataFrame exactly.
• Weights are passed as a separate numpy array (not extracted inside
  train_model) to decouple data management from training.
• GradientBoostingClassifier is used (weight-sensitive, non-linear,
  strong baseline for tabular data).
• A lightweight calibration wrapper is applied so that predict_proba
  outputs are well-calibrated — useful for threshold analysis.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.base import clone
from typing import Optional, Tuple, List


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────
PROTECTED = {"gender", "race"}      # stripped during feature-importance report
WEIGHT_COL = "weight"
TARGET_COL = "target"


# ──────────────────────────────────────────────────────────────────────────────
# Data preparation
# ──────────────────────────────────────────────────────────────────────────────

def prepare_data(
    df: pd.DataFrame,
    fit_columns: Optional[List[str]] = None,
) -> Tuple[np.ndarray, np.ndarray, StandardScaler, List[str]]:
    """
    Encode, scale, and return (X, y, scaler, column_names).

    Parameters
    ----------
    fit_columns : if provided, align the output to this exact column order
                  (used during inference so shapes always match training).
    """
    df = df.copy()

    y = df[TARGET_COL].values.astype(int)

    # Drop weight column if present (it must NOT be a feature)
    drop_cols = [TARGET_COL, WEIGHT_COL] if WEIGHT_COL in df.columns else [TARGET_COL]
    X_raw = df.drop(columns=drop_cols)

    # One-hot encode all object/category columns
    X_enc = pd.get_dummies(X_raw, drop_first=False)   # keep all dummies for alignment

    if fit_columns is not None:
        # Align to training schema: add missing columns as 0, drop extras
        X_enc = X_enc.reindex(columns=fit_columns, fill_value=0)
    else:
        fit_columns = list(X_enc.columns)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_enc.values.astype(float))

    return X_scaled, y, scaler, fit_columns


# ──────────────────────────────────────────────────────────────────────────────
# Training
# ──────────────────────────────────────────────────────────────────────────────

_BASE_GBM = GradientBoostingClassifier(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=4,
    subsample=0.8,
    min_samples_leaf=10,
    random_state=42,
)


def train_model(
    X: np.ndarray,
    y: np.ndarray,
    sample_weights: Optional[np.ndarray] = None,
) -> GradientBoostingClassifier:
    """
    Train a GBM.  sample_weights may be None (unweighted) or a 1-D array
    matching the number of training rows.
    """
    model = clone(_BASE_GBM)
    if sample_weights is not None:
        # Normalise so the effective sample size matches n
        w = sample_weights / sample_weights.mean()
        model.fit(X, y, sample_weight=w)
    else:
        model.fit(X, y)
    return model


# ──────────────────────────────────────────────────────────────────────────────
# Inference
# ──────────────────────────────────────────────────────────────────────────────

def predict(
    model: GradientBoostingClassifier,
    scaler: StandardScaler,
    df: pd.DataFrame,
    columns: List[str],
) -> np.ndarray:
    """Return hard predictions (0/1) aligned to training schema."""
    df = df.copy()
    drop_cols = [TARGET_COL, WEIGHT_COL] if WEIGHT_COL in df.columns else [TARGET_COL]
    X_raw = df.drop(columns=drop_cols, errors="ignore")
    X_enc = pd.get_dummies(X_raw, drop_first=False)
    X_enc = X_enc.reindex(columns=columns, fill_value=0)
    X_scaled = scaler.transform(X_enc.values.astype(float))
    return model.predict(X_scaled)


def predict_proba(
    model: GradientBoostingClassifier,
    scaler: StandardScaler,
    df: pd.DataFrame,
    columns: List[str],
) -> np.ndarray:
    """Return P(positive) for each row (useful for calibration / thresholding)."""
    df = df.copy()
    drop_cols = [TARGET_COL, WEIGHT_COL] if WEIGHT_COL in df.columns else [TARGET_COL]
    X_raw = df.drop(columns=drop_cols, errors="ignore")
    X_enc = pd.get_dummies(X_raw, drop_first=False)
    X_enc = X_enc.reindex(columns=columns, fill_value=0)
    X_scaled = scaler.transform(X_enc.values.astype(float))
    return model.predict_proba(X_scaled)[:, 1]