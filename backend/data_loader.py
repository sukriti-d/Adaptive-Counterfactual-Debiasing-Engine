"""
data_loader.py  –  ACDE Data Loading & Synthetic Dataset Generator
=======================================================================
Supports:
  • Loading real CSVs with automatic preprocessing
  • Generating a strongly-biased synthetic dataset for reproducible demos
  • Returning metadata about protected attributes for downstream modules
"""

import numpy as np
import pandas as pd
from typing import Optional


# ──────────────────────────────────────────────────────────────────────────────
# Real-data loader
# ──────────────────────────────────────────────────────────────────────────────

def load_dataset(path: str) -> pd.DataFrame:
    """Load and minimally validate a CSV dataset."""
    df = pd.read_csv(path)
    df = df.dropna()
    if "target" not in df.columns:
        raise ValueError("Dataset must contain a 'target' binary column.")
    df["target"] = df["target"].astype(int)
    print(f"  Loaded '{path}': {df.shape[0]} rows × {df.shape[1]} cols")
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Synthetic biased dataset  (used when no real CSV is provided)
# ──────────────────────────────────────────────────────────────────────────────

def create_biased_dataset(
    n: int = 2_000,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate a synthetic hiring/lending dataset with strong intersectional bias.

    Design choices
    ──────────────
    • Gender (Male/Female) and Race (A/B/C) are the protected attributes.
    • The *positive outcome* (target=1 = selected/approved) is strongly
      over-represented in the Male/Race-A subgroup.
    • Overall positive rate is ~35 % (realistic for hiring/lending datasets).
    • Three legitimate predictors (skill, experience, education) are included
      so the debiased model still has real signal to work with.
    • Noise level ~8 % keeps pre-mitigation accuracy in a realistic range.

    Group positive-rate design targets (approximate):
        Male   / A  →  ~60 %   (most privileged)
        Male   / B  →  ~40 %
        Male   / C  →  ~30 %
        Female / A  →  ~30 %
        Female / B  →  ~20 %
        Female / C  →  ~15 %   (most disadvantaged)
    """
    rng = np.random.default_rng(seed)

    gender = rng.choice(["Male", "Female"], size=n, p=[0.52, 0.48])
    race   = rng.choice(["A", "B", "C"],   size=n, p=[0.45, 0.35, 0.20])
    age    = rng.integers(22, 62, size=n)

    # ── Legitimate features ──────────────────────────────────────────────────
    base_skill = rng.normal(0.5, 0.15, n).clip(0, 1)
    base_exp   = rng.integers(0, 20, n).astype(float)
    base_edu   = rng.choice([0, 1, 2, 3], n, p=[0.10, 0.35, 0.35, 0.20])

    # ── Biased score (legitimate features + discriminatory component) ─────────
    # Encode groups as floats
    is_male  = (gender == "Male").astype(float)
    is_raceA = (race   == "A").astype(float)
    is_raceB = (race   == "B").astype(float)

    score = (
        # Legitimate signal
        1.20 * base_skill
        + 0.06 * (base_exp / 20.0)
        + 0.30 * (base_edu / 3.0)
        # Discriminatory component (pure bias, NOT justified by skill)
        + 1.10 * is_male                        # gender bias
        + 0.60 * is_raceA                       # race A advantage
        + 0.20 * is_raceB                       # race B slight advantage
        + 0.45 * (is_male * is_raceA)           # intersectional compounding
        - 0.25 * ((1 - is_male) * (1 - is_raceA))  # compounding disadvantage
    )

    # Logistic transform centred to achieve ~35 % overall positive rate
    z    = score - np.percentile(score, 65)      # shift so P(z>0) ≈ 35 %
    prob = 1.0 / (1.0 + np.exp(-3.5 * z))

    # Add 8 % random flip noise
    flip   = rng.random(n) < 0.08
    target = (rng.random(n) < prob).astype(int)
    target[flip] = 1 - target[flip]

    df = pd.DataFrame({
        "age":             age,
        "gender":          gender,
        "race":            race,
        "skill_score":     np.round(base_skill, 4),
        "experience_yrs":  base_exp.astype(int),
        "education_level": base_edu,
        "target":          target,
    })

    # ── Verify bias is actually present ──────────────────────────────────────
    grp_rates  = df.groupby(["gender", "race"])["target"].mean()
    disparity  = grp_rates.max() - grp_rates.min()
    print(f"  Synthetic dataset: {n} rows  |  "
          f"overall positive rate: {target.mean():.3f}  |  "
          f"max intersectional disparity: {disparity:.3f}")
    print(f"  Group rates:\n{grp_rates.to_string()}")

    return df