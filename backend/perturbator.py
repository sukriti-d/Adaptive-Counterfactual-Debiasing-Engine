"""
perturbator.py  –  ACDE Counterfactual Generator
=======================================================================
Generates counterfactual copies of the dataset by flipping protected
attribute values.  Supports arbitrary binary or multi-valued columns.

For a binary column   {A, B}  → swap A↔B.
For a multi-valued column     → cycle to the next value (alphabetically
sorted) so every row gets a *different* value from its original.

All non-protected columns are left untouched so that the counterfactual
differs ONLY in the specified sensitive attribute(s).
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Optional


def _build_flip_map(values: pd.Series) -> Dict:
    """Build a deterministic value-swap mapping for a categorical column."""
    unique = sorted(values.unique())
    if len(unique) == 2:                         # binary: simple swap
        return {unique[0]: unique[1], unique[1]: unique[0]}
    else:                                        # multi-class: rotate by 1
        rotated = unique[1:] + [unique[0]]
        return dict(zip(unique, rotated))


def generate_counterfactual(
    df: pd.DataFrame,
    features: List[str],
    flip_maps: Optional[Dict[str, Dict]] = None,
) -> pd.DataFrame:
    """
    Return a new DataFrame identical to *df* except that each column in
    *features* has been flipped according to its swap mapping.

    Parameters
    ----------
    df        : original dataset (NOT modified in place)
    features  : list of column names to perturb (e.g. ['gender'])
    flip_maps : optional pre-built {column: {old_val: new_val}} dict;
                if None it is derived automatically from the data.

    Returns
    -------
    pd.DataFrame – same index/shape as df, with perturbed columns.
    """
    df_cf = df.copy()

    for feat in features:
        if feat not in df_cf.columns:
            raise KeyError(f"Column '{feat}' not found in dataset.")
        mapping = (flip_maps or {}).get(feat) or _build_flip_map(df_cf[feat])
        unmapped = set(df_cf[feat].unique()) - set(mapping.keys())
        if unmapped:
            raise ValueError(
                f"Flip map for '{feat}' missing values: {unmapped}. "
                "Pass an explicit flip_maps dict or ensure all values are covered."
            )
        df_cf[feat] = df_cf[feat].map(mapping)

    return df_cf


def generate_all_counterfactuals(
    df: pd.DataFrame,
    protected: List[str],
) -> Dict[str, pd.DataFrame]:
    """
    Convenience wrapper: generate one counterfactual per protected attribute
    and one joint counterfactual flipping all at once.

    Returns
    -------
    dict mapping scenario_name → counterfactual DataFrame
    """
    results: Dict[str, pd.DataFrame] = {}
    for feat in protected:
        results[f"flip_{feat}"] = generate_counterfactual(df, [feat])
    if len(protected) > 1:
        results["flip_all"] = generate_counterfactual(df, protected)
    return results