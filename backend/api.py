"""
api.py – ACDE FastAPI Backend
=======================================================================
Endpoints:
  POST /upload         – Upload a CSV and get dataset summary
  POST /train          – Train baseline model, run bias audit
  POST /mitigate       – Apply IPW mitigation and compare
  GET  /demo           – Run pipeline on synthetic data
  GET  /health         – Health check
"""

from dotenv import load_dotenv
load_dotenv()
import io
import uuid
import warnings
import traceback
from typing import Optional, List

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.gemini_advisor import generate_bias_advisory
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score, balanced_accuracy_score
)

warnings.filterwarnings("ignore")

# ACDE modules
from backend.data_loader    import load_dataset, create_biased_dataset
from backend.predictor      import prepare_data, train_model, predict, predict_proba
from backend.perturbator    import generate_counterfactual, generate_all_counterfactuals
from backend.instability    import calculate_instability, group_instability, flip_breakdown, idi_score
from backend.intersectional import intersectional_bias, all_metrics
from backend.mitigator      import apply_reweighting, debias_dataset
from backend.report         import fairness_score

# ── In-memory session store ─────────────────────────────────────────────────
SESSIONS = {}

app = FastAPI(title="ACDE API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def eval_model(model, scaler, df, cols):
    preds = predict(model, scaler, df, cols)
    probs = predict_proba(model, scaler, df, cols)
    y     = df["target"].values
    auc   = roc_auc_score(y, probs) if len(np.unique(y)) > 1 else 0.5
    return preds, probs, {
        "accuracy":  round(float(accuracy_score(y, preds)), 4),
        "balanced":  round(float(balanced_accuracy_score(y, preds)), 4),
        "f1":        round(float(f1_score(y, preds, zero_division=0)), 4),
        "roc_auc":   round(float(auc), 4),
    }


def df_to_bias_list(bias_df: pd.DataFrame) -> list:
    rows = []
    for _, r in bias_df.iterrows():
        rows.append({
            "group":         str(r["group"]),
            "n":             int(r["n"]),
            "positive_rate": float(r["positive_rate"]),
            "disparity":     float(r["disparity"]),
            "tpr":           float(r["tpr"]) if not pd.isna(r.get("tpr", float("nan"))) else None,
            "fpr":           float(r["fpr"]) if not pd.isna(r.get("fpr", float("nan"))) else None,
            "precision":     float(r["precision"]) if not pd.isna(r.get("precision", float("nan"))) else None,
        })
    return rows


def gi_to_list(gi_df: pd.DataFrame) -> list:
    rows = []
    for _, r in gi_df.iterrows():
        rows.append({
            "group":            str(r["group"]),
            "n":                int(r["n"]),
            "instability_rate": float(r["instability_rate"]),
            "neg_to_pos":       int(r["neg_to_pos"]),
            "pos_to_neg":       int(r["pos_to_neg"]),
        })
    return rows


def run_pipeline(df: pd.DataFrame):
    """Core ACDE pipeline – returns a dict with before/after results."""
    PROTECTED = [c for c in ["gender", "race"] if c in df.columns]
    if not PROTECTED:
        # Auto-detect low-cardinality string columns
        for col in df.columns:
            if col == "target":
                continue
            if df[col].dtype == object and df[col].nunique() <= 10:
                PROTECTED.append(col)
    if not PROTECTED:
        raise ValueError("No protected attributes found in dataset.")

    # ── Baseline ─────────────────────────────────────────────────────────────
    X1, y1, sc1, cols1 = prepare_data(df)
    model1 = train_model(X1, y1)
    pred1, prob1, perf1 = eval_model(model1, sc1, df, cols1)

    # ── Counterfactual instability ────────────────────────────────────────────
    cf_scenarios = generate_all_counterfactuals(df, PROTECTED)
    primary_cf   = f"flip_{PROTECTED[0]}"
    df_cf_primary = cf_scenarios[primary_cf]
    pred_cf1  = predict(model1, sc1, df_cf_primary, cols1)
    prob_cf1  = predict_proba(model1, sc1, df_cf_primary, cols1)
    inst_b, _ = calculate_instability(pred1, pred_cf1)
    idi_b     = idi_score(prob1, prob_cf1)
    fb_b      = flip_breakdown(pred1, pred_cf1)
    gi_b      = group_instability(df, pred1, pred_cf1, PROTECTED)

    # All scenarios for full instability tab
    all_inst = {}
    for sc_name, df_cf_sc in cf_scenarios.items():
        pc = predict(model1, sc1, df_cf_sc, cols1)
        pb = predict_proba(model1, sc1, df_cf_sc, cols1)
        rate, _ = calculate_instability(pred1, pc)
        idi      = idi_score(prob1, pb)
        fb       = flip_breakdown(pred1, pc)
        gi       = group_instability(df, pred1, pc, PROTECTED)
        all_inst[sc_name] = {
            "flip_rate": round(float(rate), 4),
            "idi":       round(float(idi), 4),
            "flip_breakdown": fb,
            "group_instability": gi_to_list(gi),
        }

    # ── Intersectional bias BEFORE ────────────────────────────────────────────
    bias1    = intersectional_bias(df, pred1, PROTECTED)
    metrics1 = all_metrics(bias1)
    fs_b     = fairness_score(inst_b, bias1, idi_b)

    # ── Mitigation ────────────────────────────────────────────────────────────
    df_w  = apply_reweighting(df, bias1, group_cols=PROTECTED)
    df_w  = debias_dataset(df_w)
    X2, y2, sc2, cols2 = prepare_data(df_w)
    model2 = train_model(X2, y2, sample_weights=df_w["weight"].values)
    pred2, prob2, perf2 = eval_model(model2, sc2, df_w, cols2)

    # ── Counterfactual instability AFTER ─────────────────────────────────────
    df_cf2    = generate_counterfactual(df, [PROTECTED[0]])
    pred_cf2  = predict(model2, sc2, df_cf2, cols2)
    prob_cf2  = predict_proba(model2, sc2, df_cf2, cols2)
    inst_a, _ = calculate_instability(pred2[:len(pred_cf2)], pred_cf2)
    idi_a     = idi_score(prob2[:len(prob_cf2)], prob_cf2)
    gi_a      = group_instability(df, pred2[:len(df)], pred_cf2, PROTECTED)

    # ── Intersectional bias AFTER ─────────────────────────────────────────────
    bias2    = intersectional_bias(df_w, pred2, PROTECTED)
    metrics2 = all_metrics(bias2)
    fs_a     = fairness_score(inst_a, bias2, idi_a)

    # ── Derived comparison metrics ────────────────────────────────────────────
    disp_b = float(bias1["disparity"].max())
    disp_a = float(bias2["disparity"].max())
    dpd_b  = metrics1["demographic_parity_difference"]
    dpd_a  = metrics2["demographic_parity_difference"]
    eov_b  = metrics1["equalized_odds_violation"]
    eov_a  = metrics2["equalized_odds_violation"]

    return {
        "protected_attributes": PROTECTED,
        "n_rows": len(df),
        "positive_rate": round(float(df["target"].mean()), 4),
        "group_rates": {
            str(k): round(float(v), 4)
            for k, v in df.groupby(PROTECTED[0])["target"].mean().items()
            
        },
        "before": {
            "performance": perf1,
            "bias_table":  df_to_bias_list(bias1),
            "metrics":     {k: float(v) for k, v in metrics1.items()},
            "fairness_score": round(float(fs_b), 4),
            "instability": {
                "flip_rate":        round(float(inst_b), 4),
                "idi":              round(float(idi_b), 4),
                "flip_breakdown":   fb_b,
                "group_instability": gi_to_list(gi_b),
            },
            "all_instability_scenarios": all_inst,
        },
        "after": {
            "performance": perf2,
            "bias_table":  df_to_bias_list(bias2),
            "metrics":     {k: float(v) for k, v in metrics2.items()},
            "fairness_score": round(float(fs_a), 4),
            "instability": {
                "flip_rate": round(float(inst_a), 4),
                "idi":       round(float(idi_a), 4),
                "group_instability": gi_to_list(gi_a),
            },
        },
        "comparison": {
            "bias_reduction":    round((disp_b - disp_a) / disp_b * 100, 1) if disp_b > 0 else 0,
            "dpd_reduction":     round((dpd_b - dpd_a) / dpd_b * 100, 1) if dpd_b > 0 else 0,
            "eov_reduction":     round((eov_b - eov_a) / eov_b * 100, 1) if eov_b > 0 else 0,
            "fairness_gain":     round(float(fs_a - fs_b), 4),
            "accuracy_cost":     round(float(perf1["accuracy"] - perf2["accuracy"]), 4),
            "flip_rate_reduction": round((inst_b - inst_a) / inst_b * 100, 1) if inst_b > 0 else 0,
        },
        "_df_w": df_w,  # ← include debiased df for export
    }


# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/demo")
def demo():
    try:
        df = create_biased_dataset(n=2000)
        result = run_pipeline(df)
        result["source"] = "synthetic"
        result["columns"] = list(df.columns)
        result["preview"] = df.head(10).to_dict(orient="records")
        
        session_id = str(uuid.uuid4())       # ← add this
        SESSIONS[session_id] = {"df": df}    # ← add this
        result["session_id"] = session_id    # ← add this
        
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    """Upload and preview a CSV dataset."""
    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
        df = df.dropna()
        if "target" not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="CSV must contain a 'target' binary column (0/1)."
            )
        df["target"] = df["target"].astype(int)

        session_id = str(uuid.uuid4())
        SESSIONS[session_id] = {"df": df}

        # Detect potential protected attributes
        protected_candidates = []
        for col in df.columns:
            if col == "target":
                continue
            if df[col].dtype == object or df[col].nunique() <= 10:
                protected_candidates.append(col)

        return {
            "session_id":           session_id,
            "n_rows":               len(df),
            "n_cols":               len(df.columns),
            "columns":              list(df.columns),
            "dtypes":               {c: str(df[c].dtype) for c in df.columns},
            "positive_rate":        round(float(df["target"].mean()), 4),
            "protected_candidates": protected_candidates,
            "preview":              df.head(10).to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/{session_id}")
def analyze(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a dataset first.")
    try:
        df = SESSIONS[session_id]["df"]
        
        
        # Run pipeline AND capture df_w
        PROTECTED = [c for c in ["gender", "race"] if c in df.columns]
        if not PROTECTED:
            for col in df.columns:
                if col == "target": continue
                if df[col].dtype == object and df[col].nunique() <= 10:
                    PROTECTED.append(col)
        
        from backend.mitigator import apply_reweighting, debias_dataset
        from backend.intersectional import intersectional_bias
        from backend.predictor import prepare_data, train_model
        X1, y1, sc1, cols1 = prepare_data(df)
        model1 = train_model(X1, y1)
        from backend.predictor import predict
        pred1 = predict(model1, sc1, df, cols1)
        bias1 = intersectional_bias(df, pred1, PROTECTED)
        df_w = apply_reweighting(df, bias1, group_cols=PROTECTED)
        df_w = debias_dataset(df_w)
        
        result = run_pipeline(df)
        df_w = result.pop("_df_w", None)
        SESSIONS[session_id]["df_w"] = df_w  

        result["source"] = "upload"
        result["columns"] = list(df.columns)
        result["preview"] = df.head(10).to_dict(orient="records")
        result["session_id"] = session_id
        
        SESSIONS[session_id]["result"] = result
        SESSIONS[session_id]["df_w"] = df_w  # ← save debiased df
        
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/export/{session_id}")
def export_debiased(session_id: str):
session = sessions.get(session_id)

if not session and sessions:
    session = list(sessions.values())[-1]

if not session:
    raise HTTPException(status_code=404, detail="Session not found.")
    try:
        from fastapi.responses import StreamingResponse
        df_w = SESSIONS[session_id].get("df_w")
        df_export = df_w if (df_w is not None) else SESSIONS[session_id]["df"]
        csv_bytes = df_export.to_csv(index=False).encode()
        return StreamingResponse(
            iter([csv_bytes]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=acde_debiased_dataset.csv"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/gemini-advisory/{session_id}")
def gemini_advisory(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found.")
    try:
        result = SESSIONS[session_id].get("result")
        if not result:
            raise HTTPException(status_code=400, detail="Run analysis first.")
        advisory = generate_bias_advisory(result)
        return advisory
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
