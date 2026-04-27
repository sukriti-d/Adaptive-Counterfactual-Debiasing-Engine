"""
main.py  –  ACDE Pipeline Orchestrator
=======================================================================
Adaptive Counterfactual Debiasing Engine
Full Before → Mitigation → After Evaluation

Run:
    python main.py              # uses synthetic biased dataset
    python main.py data.csv     # uses your own CSV (needs 'target' column)
"""

import sys
import time
import warnings
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score, balanced_accuracy_score
)

warnings.filterwarnings("ignore")

# ── ACDE modules ──────────────────────────────────────────────────────────────
from data_loader   import load_dataset, create_biased_dataset
from predictor     import prepare_data, train_model, predict, predict_proba
from perturbator   import generate_counterfactual, generate_all_counterfactuals
from instability   import (calculate_instability, group_instability,
                            flip_breakdown, idi_score)
from intersectional import (intersectional_bias, all_metrics,
                             demographic_parity_difference)
from mitigator     import apply_reweighting, debias_dataset
from report        import generate_report, fairness_score
from visualizer    import generate_figures


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def section(title: str):
    print(f"\n{'═'*68}")
    print(f"  {title}")
    print(f"{'═'*68}")


def eval_model(model, scaler, df, cols, label=""):
    preds = predict(model, scaler, df, cols)
    probs = predict_proba(model, scaler, df, cols)
    y     = df["target"].values
    auc   = roc_auc_score(y, probs) if len(np.unique(y)) > 1 else 0.5
    metrics = {
        "accuracy":  round(accuracy_score(y, preds), 4),
        "balanced":  round(balanced_accuracy_score(y, preds), 4),
        "f1":        round(f1_score(y, preds, zero_division=0), 4),
        "roc_auc":   round(auc, 4),
    }
    if label:
        print(f"  [{label}]  "
              f"Acc={metrics['accuracy']}  "
              f"BAcc={metrics['balanced']}  "
              f"F1={metrics['f1']}  "
              f"AUC={metrics['roc_auc']}")
    return preds, probs, metrics


# ──────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ──────────────────────────────────────────────────────────────────────────────

def main():
    t0 = time.time()
    print("\n" + "▓" * 68)
    print("  ACDE — Adaptive Counterfactual Debiasing Engine")
    print(" Fairness Audit Pipeline")
    print("▓" * 68)

    # ── 1. Data ───────────────────────────────────────────────────────────────
    section("1 · DATA LOADING")
    csv_path = sys.argv[1] if len(sys.argv) > 1 else None
    if csv_path:
        try:
            df = load_dataset(csv_path)
            print(f"  Real dataset loaded: {csv_path}")
        except Exception as e:
            print(f"  Could not load '{csv_path}': {e}")
            print("  Falling back to synthetic dataset.")
            df = create_biased_dataset(n=2000)
    else:
        print("  No CSV provided → generating synthetic biased dataset.")
        df = create_biased_dataset(n=2000)

    print(f"\n  Shape  : {df.shape}")
    print(f"  Columns: {list(df.columns)}")
    print(f"  Target balance: {df['target'].mean():.3f} positive rate")
    print(f"\n  Preview:\n{df.head(5).to_string(index=False)}")

    PROTECTED = [c for c in ["gender", "race"] if c in df.columns]
    print(f"\n  Protected attributes detected: {PROTECTED}")

    # ── 2. Baseline model ─────────────────────────────────────────────────────
    section("2 · BASELINE MODEL TRAINING")
    X_tr, y_tr, sc1, cols1 = prepare_data(df)
    model1 = train_model(X_tr, y_tr)
    pred1, prob1, perf1 = eval_model(model1, sc1, df, cols1, "Baseline")

    # ── 3. Counterfactual analysis ────────────────────────────────────────────
    section("3 · COUNTERFACTUAL INSTABILITY ANALYSIS")
    cf_scenarios = generate_all_counterfactuals(df, PROTECTED)

    inst_results = {}
    for scenario, df_cf in cf_scenarios.items():
        pred_cf = predict(model1, sc1, df_cf, cols1)
        prob_cf = predict_proba(model1, sc1, df_cf, cols1)
        rate, changes = calculate_instability(pred1, pred_cf)
        idi = idi_score(prob1, prob_cf)
        fb  = flip_breakdown(pred1, pred_cf)
        gi  = group_instability(df, pred1, pred_cf, PROTECTED)
        inst_results[scenario] = {
            "rate": rate, "idi": idi, "flip_breakdown": fb,
            "group_instability": gi
        }
        print(f"\n  Scenario: {scenario}")
        print(f"    Flip Rate : {rate:.4f}  |  IDI : {idi:.4f}")
        print(f"    Flip breakdown: {fb}")
        print(f"    Group instability:\n{gi.to_string(index=False)}")

    # Primary scenario for reporting
    primary_cf = f"flip_{PROTECTED[0]}"
    inst_before = inst_results[primary_cf]["rate"]
    idi_before  = inst_results[primary_cf]["idi"]
    gi_before   = inst_results[primary_cf]["group_instability"]

    # ── 4. Intersectional bias ────────────────────────────────────────────────
    section("4 · INTERSECTIONAL BIAS ASSESSMENT (BEFORE)")
    bias1    = intersectional_bias(df, pred1, PROTECTED)
    metrics1 = all_metrics(bias1)

    print(f"\n  Bias table:\n{bias1.to_string(index=False)}")
    print(f"\n  Scalar metrics:")
    for k, v in metrics1.items():
        print(f"    {k:40s}: {v}")

    report_before = generate_report(
        inst_before, bias1, metrics1, phase="BEFORE MITIGATION", idi=idi_before
    )
    print(f"\n{report_before}")
    fs_before = fairness_score(inst_before, bias1, idi_before)

    # ── 5. Mitigation ─────────────────────────────────────────────────────────
    section("5 · BIAS MITIGATION (IPW + ITERATIVE REWEIGHTING)")
    df_w = apply_reweighting(df, bias1, group_cols=PROTECTED)
    df_w = debias_dataset(df_w)

    print(f"\n  Weight statistics:")
    print(df_w["weight"].describe().to_string())
    print(f"\n  Effective sample size: {df_w['weight'].sum()**2 / (df_w['weight']**2).sum():.1f}")

    X_tr2, y_tr2, sc2, cols2 = prepare_data(df_w)
    model2 = train_model(X_tr2, y_tr2, sample_weights=df_w["weight"].values)

    pred2, prob2, perf2 = eval_model(model2, sc2, df_w, cols2, "Debiased")

    # ── 6. Post-mitigation evaluation ────────────────────────────────────────
    section("6 · POST-MITIGATION EVALUATION")
    bias2    = intersectional_bias(df_w, pred2, PROTECTED)
    metrics2 = all_metrics(bias2)

    # Counterfactual instability of debiased model
    df_cf2   = generate_counterfactual(df, [PROTECTED[0]])
    pred_cf2 = predict(model2, sc2, df_cf2, cols2)
    prob_cf2 = predict_proba(model2, sc2, df_cf2, cols2)
    inst_after, _ = calculate_instability(pred2[:len(pred_cf2)], pred_cf2)
    idi_after      = idi_score(prob2[:len(prob_cf2)], prob_cf2)
    gi_after       = group_instability(df, pred2[:len(df)], pred_cf2, PROTECTED)

    print(f"\n  Bias table (after):\n{bias2.to_string(index=False)}")
    print(f"\n  Scalar metrics (after):")
    for k, v in metrics2.items():
        print(f"    {k:40s}: {v}")

    report_after = generate_report(
        inst_after, bias2, metrics2, phase="AFTER MITIGATION", idi=idi_after
    )
    print(f"\n{report_after}")
    fs_after = fairness_score(inst_after, bias2, idi_after)

    # ── 7. Final comparison ───────────────────────────────────────────────────
    section("7 · BEFORE vs AFTER COMPARISON")

    disp_b = float(bias1["disparity"].max())
    disp_a = float(bias2["disparity"].max())
    bias_reduction = (disp_b - disp_a) / disp_b * 100 if disp_b > 0 else 0.0

    dpd_b = metrics1.get("demographic_parity_difference", 0)
    dpd_a = metrics2.get("demographic_parity_difference", 0)
    dpd_reduction = (dpd_b - dpd_a) / dpd_b * 100 if dpd_b > 0 else 0.0

    eov_b = metrics1.get("equalized_odds_violation", 0)
    eov_a = metrics2.get("equalized_odds_violation", 0)
    eov_reduction = (eov_b - eov_a) / eov_b * 100 if eov_b > 0 else 0.0

    print(f"""
  ┌─────────────────────────────────────────────────────────────┐
  │              FAIRNESS–UTILITY TRADEOFF SUMMARY              │
  ├──────────────────────────────┬─────────────┬────────────────┤
  │ Metric                       │   Before    │     After      │
  ├──────────────────────────────┼─────────────┼────────────────┤
  │ Accuracy                     │  {perf1['accuracy']:<11.4f}│  {perf2['accuracy']:<14.4f}│
  │ Balanced Accuracy            │  {perf1['balanced']:<11.4f}│  {perf2['balanced']:<14.4f}│
  │ F1 Score                     │  {perf1['f1']:<11.4f}│  {perf2['f1']:<14.4f}│
  │ ROC AUC                      │  {perf1['roc_auc']:<11.4f}│  {perf2['roc_auc']:<14.4f}│
  ├──────────────────────────────┼─────────────┼────────────────┤
  │ Composite Fairness Score ↑   │  {fs_before:<11.4f}│  {fs_after:<14.4f}│
  │ Max Disparity ↓              │  {disp_b:<11.4f}│  {disp_a:<14.4f}│
  │ Counterfactual Flip Rate ↓   │  {inst_before:<11.4f}│  {inst_after:<14.4f}│
  │ IDI Score ↓                  │  {idi_before:<11.4f}│  {idi_after:<14.4f}│
  │ Dem. Parity Difference ↓     │  {dpd_b:<11.4f}│  {dpd_a:<14.4f}│
  │ Equalized Odds Violation ↓   │  {eov_b:<11.4f}│  {eov_a:<14.4f}│
  ├──────────────────────────────┼─────────────┼────────────────┤
  │ Bias Reduction               │             │  {bias_reduction:>6.1f} %        │
  │ DPD Reduction                │             │  {dpd_reduction:>6.1f} %        │
  │ EOV Reduction                │             │  {eov_reduction:>6.1f} %        │
  │ Fairness Score Gain          │             │ +{fs_after - fs_before:<13.4f}│
  │ Accuracy Cost                │             │  {perf1['accuracy'] - perf2['accuracy']:<6.4f} pp       │
  └──────────────────────────────┴─────────────┴────────────────┘
    """)

    # ── 8. Figures ────────────────────────────────────────────────────────────
    section("8 · GENERATING VISUALISATION")

    summary = {
        "acc_before":    perf1["accuracy"],  "acc_after":    perf2["accuracy"],
        "fs_before":     fs_before,          "fs_after":     fs_after,
        "disp_before":   disp_b,             "disp_after":   disp_a,
        "inst_before":   inst_before,        "inst_after":   inst_after,
        "dpd_before":    dpd_b,              "dpd_after":    dpd_a,
        "bias_reduction": bias_reduction,
    }

    try:
        generate_figures(
            bias_before=bias1,
            bias_after=bias2,
            inst_before=gi_before,
            inst_after=gi_after,
            metrics_before=metrics1,
            metrics_after=metrics2,
            summary=summary,
            output_path="acde_figures.png",
        )
    except Exception as e:
        print(f"  [WARN] Could not generate figures: {e}")

    elapsed = time.time() - t0
    print(f"\n  Pipeline completed in {elapsed:.1f}s")
    print("▓" * 68 + "\n")


if __name__ == "__main__":
    main()