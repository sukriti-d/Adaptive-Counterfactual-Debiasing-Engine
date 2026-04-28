
# Adaptive-Counterfactual-Debiasing-Engine
Fairness Audit &amp; Mitigation Platform
=======
# ACDE — Adaptive Counterfactual Debiasing Engine

A full-stack bias detection and mitigation tool for binary classification datasets. Upload any CSV, and ACDE audits your data for demographic bias, measures counterfactual instability, applies Inverse Probability Weighting (IPW) mitigation, and exports a debiased dataset with a compliance audit report.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Setup & Installation](#setup--installation)
- [Running the App](#running-the-app)
- [How to Use](#how-to-use)
- [Dataset Format](#dataset-format)
- [API Reference](#api-reference)
- [Backend Modules](#backend-modules)
- [Frontend Components](#frontend-components)
- [Fairness Metrics Explained](#fairness-metrics-explained)
- [Export Outputs](#export-outputs)
- [Known Issues & Fixes](#known-issues--fixes)

---

## Overview

ACDE detects and mitigates algorithmic bias in tabular datasets. It trains a baseline classifier on your data, audits it across demographic groups, applies counterfactual perturbation to measure instability, then re-trains a fairer model using adaptive IPW reweighting. Results are shown in an interactive dashboard with before/after comparisons across all fairness metrics.

---

## Features

- **Bias Audit** — Intersectional group disparity analysis across all protected attributes
- **Counterfactual Instability** — Measures how often predictions flip when protected attributes are toggled
- **IPW Mitigation** — Inverse Probability Weighting with iterative disparity correction
- **Fairness Radar** — Visual before/after comparison across 5 fairness dimensions
- **Composite Fairness Score** — Single 0–1 score: `1 − [0.4·DPD + 0.4·EOV + 0.2·IDI]`
- **Demo Mode** — Built-in synthetic hiring dataset with strong intersectional bias for instant exploration
- **Export Debiased CSV** — Full dataset with `ipw_weight` and `acde_mitigated` columns
- **Export Audit Report** — Plain-text compliance document with all metrics and recommendations

---

## Project Structure

```
final app/
├── backend/
│   ├── api.py              # FastAPI routes and session management
│   ├── data_loader.py      # CSV loader and synthetic dataset generator
│   ├── predictor.py        # Data prep, model training, prediction
│   ├── perturbator.py      # Counterfactual generation (attribute flipping)
│   ├── instability.py      # Flip rate, IDI score, group instability
│   ├── intersectional.py   # Intersectional bias table and scalar metrics
│   ├── mitigator.py        # IPW reweighting and iterative disparity correction
│   ├── visualizer.py       # Chart data helpers
│   ├── report.py           # Fairness score and text report generator
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js
        ├── index.js
        └── components/
            ├── Dashboard.js          # Tab layout and header
            ├── UploadScreen.js       # Upload UI and demo trigger
            ├── BiasOverview.js       # Summary metrics cards
            ├── GroupDisparityChart.js # Per-group bar charts
            ├── InstabilityPanel.js   # Counterfactual scenario explorer
            ├── RadarChart.js         # Before/after fairness radar
            ├── TradeoffSummary.js    # Accuracy vs fairness tradeoff
            ├── BiasExplainer.js      # Plain-language explanations
            └── DataPreview.js        # Dataset table and export buttons
```
<img width="1919" height="894" alt="Screenshot 2026-04-27 215823" src="https://github.com/user-attachments/assets/7f25a497-b990-4dc2-9a8e-6c00031ed05f" />
<img width="1919" height="888" alt="Screenshot 2026-04-27 215615" src="https://github.com/user-attachments/assets/5b7b3e38-1321-47a9-a70e-58b3c2986d6a" />
<img width="1919" height="834" alt="Screenshot 2026-04-27 215520" src="https://github.com/user-attachments/assets/082bbe40-9433-43ac-b209-f4617272beea" />
<img width="1919" height="865" alt="Screenshot 2026-04-27 215501" src="https://github.com/user-attachments/assets/714ae190-d364-4958-9647-4690ee747de5" />
<img width="1919" height="813" alt="Screenshot 2026-04-27 215442" src="https://github.com/user-attachments/assets/ed0b7937-5f0d-47ef-ada3-ed5d90c779cc" />
<img width="1919" height="916" alt="Screenshot 2026-04-27 215420" src="https://github.com/user-attachments/assets/e29fb5ef-d6d1-4120-b8ea-0cecdd348042" />

---

## Requirements

### Backend
- Python 3.10+
- pip packages (see `backend/requirements.txt`):

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9
pandas==2.2.2
numpy==1.26.4
scikit-learn==1.5.0
pydantic==2.7.1
```

### Frontend
- Node.js 18+
- npm 9+
- React 18, Recharts, Lucide React (installed via `npm install`)

---

## Setup & Installation

### 1. Clone / extract the project

```bash
unzip final_app.zip
cd "final app"
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Running the App

Open **two terminals** from inside the `final app/` directory.

### Terminal 1 — Backend

```bash
cd backend
uvicorn api:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

### Terminal 2 — Frontend

```bash
cd frontend
npm start
```

The app will open at `http://localhost:3000`. The frontend proxies all `/api` calls to `localhost:8000` via the `"proxy"` field in `package.json`.

---

## How to Use

### Option A — Demo Mode
Click **"Run Demo"** on the upload screen. ACDE loads a built-in synthetic hiring dataset (2,000 rows, gender + race protected attributes) with strong intentional bias. No file needed.

### Option B — Upload Your Own CSV
1. Click **"Upload CSV"** and select your file.
2. ACDE automatically detects protected attributes (low-cardinality or string columns).
3. The full pipeline runs: baseline model → bias audit → mitigation → comparison.
4. Explore results across the 7 dashboard tabs.

### Dashboard Tabs

| Tab | What it shows |
|---|---|
| **Overview** | Summary cards: fairness score, key metric changes, top-level comparison |
| **Group Disparity** | Per-group positive rate, TPR, FPR, precision — before and after |
| **Counterfactual** | Flip rate and IDI per scenario (flip gender, flip race, etc.) |
| **Fairness Radar** | Radar chart comparing 5 fairness dimensions before vs after |
| **Tradeoff** | Accuracy cost vs fairness gain scatter/summary |
| **Explanation** | Plain-language description of what each metric means and why it matters |
| **Dataset** | Data preview table, column schema, group rates, and export buttons |

---

## Dataset Format

Your CSV must have:

- A column named **`target`** containing binary values (`0` or `1`)
- At least one **protected attribute** — a string column or numeric column with ≤ 10 unique values (e.g. `gender`, `race`, `age_group`)
- No missing values (rows with NaN are dropped automatically)

**Example columns:**

```
age, gender, race, skill_score, experience_yrs, education_level, target
```

ACDE auto-detects `gender` and `race` as protected attributes. Any other low-cardinality string columns are also detected automatically.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{"status": "ok"}` |
| `GET` | `/demo` | Run pipeline on built-in synthetic dataset |
| `POST` | `/upload` | Upload a CSV; returns session ID and dataset preview |
| `POST` | `/analyze/{session_id}` | Run full ACDE pipeline on uploaded dataset |
| `GET` | `/export/{session_id}` | Download debiased CSV with IPW weights |

### `POST /upload` — Response

```json
{
  "session_id": "uuid",
  "n_rows": 2000,
  "n_cols": 7,
  "columns": ["age", "gender", ...],
  "positive_rate": 0.347,
  "protected_candidates": ["gender", "race"],
  "preview": [ {...}, ... ]
}
```

### `POST /analyze/{session_id}` — Response (abbreviated)

```json
{
  "session_id": "uuid",
  "protected_attributes": ["gender", "race"],
  "n_rows": 2000,
  "before": {
    "performance": { "accuracy": 0.81, "f1": 0.74, "roc_auc": 0.88 },
    "fairness_score": 0.42,
    "bias_table": [ { "group": "Male/A", "disparity": 0.38, ... } ],
    "instability": { "flip_rate": 0.29, "idi": 0.18 }
  },
  "after": {
    "performance": { "accuracy": 0.77, "f1": 0.71, "roc_auc": 0.85 },
    "fairness_score": 0.71,
    "bias_table": [ ... ],
    "instability": { "flip_rate": 0.11, "idi": 0.07 }
  },
  "comparison": {
    "bias_reduction": 48.2,
    "fairness_gain": 0.29,
    "accuracy_cost": 0.04
  }
}
```

---

## Backend Modules

### `api.py`
FastAPI application. Manages in-memory sessions (`SESSIONS` dict), orchestrates the pipeline, and serves all HTTP routes. Sessions store the original DataFrame (`df`), the debiased DataFrame with weights (`df_w`), and the result dict.

### `data_loader.py`
Loads CSVs and generates the synthetic biased dataset. The synthetic dataset simulates a hiring/lending scenario with 6 intersectional groups across gender × race, designed with positive-rate gaps ranging from ~15% to ~60%.

### `predictor.py`
Handles feature encoding (one-hot for categoricals, standard scaling for numerics), trains a `RandomForestClassifier`, and exposes `predict()` / `predict_proba()` helpers.

### `perturbator.py`
Generates counterfactual versions of the dataset by flipping protected attribute values (e.g. Male → Female). Supports single-attribute and multi-attribute flips via `generate_all_counterfactuals()`.

### `instability.py`
Computes:
- **Flip rate** — fraction of rows where prediction changes after counterfactual flip
- **IDI (Individual Discrimination Index)** — mean absolute change in predicted probability
- **Group instability** — per-group flip breakdown

### `intersectional.py`
Builds the bias table with per-group metrics: positive rate, disparity (vs. overall), TPR, FPR, precision. Also computes scalar metrics: Demographic Parity Difference, Equalized Odds Violation, Predictive Parity Difference, Disparate Impact Ratio.

### `mitigator.py`
Three-stage reweighting pipeline:
1. **IPW** — `w_i = P(Y) / P(Y | group)` per row
2. **Iterative disparity correction** — amplifies weights for disadvantaged groups until disparity < 0.02 or 10 iterations
3. **Clipping** — clips at 95th percentile, normalises to mean = 1

### `report.py`
Computes the composite fairness score: `F = 1 − [0.4·DPD + 0.4·EOV + 0.2·IDI]`, and generates the text audit report.

---

## Frontend Components

### `App.js`
Root state manager. Holds `result`, `sessionId`, `loading`, `error`, `source`. Runs `/upload` → `/analyze` on file upload, `/demo` for demo mode.

### `UploadScreen.js`
Landing page with drag-and-drop file upload and demo button.

### `Dashboard.js`
Sticky header with fairness score chips, 7-tab navigation, and routes to all panel components. Receives `data`, `sessionId`, `source` as props.

### `DataPreview.js`
Shows the dataset table, column schema, group positive rates, and the two export buttons. The **Export Debiased CSV** button calls `GET /export/{sessionId}` on the backend. The **Export Audit Report** button builds and downloads a `.txt` file client-side from the result data.

---

## Fairness Metrics Explained

| Metric | Formula | Threshold |
|---|---|---|
| **Demographic Parity Difference (DPD)** | `max(P(Ŷ=1\|G)) − min(P(Ŷ=1\|G))` | < 0.10 = acceptable |
| **Equalized Odds Violation (EOV)** | `max(TPR gap, FPR gap) across groups` | < 0.10 = acceptable |
| **Predictive Parity Difference** | `max(precision\|G) − min(precision\|G)` | < 0.10 = acceptable |
| **Disparate Impact Ratio (DIR)** | `min(P(Ŷ=1\|G)) / max(P(Ŷ=1\|G))` | ≥ 0.80 = passes 4/5ths rule |
| **Counterfactual Flip Rate** | `fraction of predictions that change on attribute flip` | < 0.15 = acceptable |
| **IDI Score** | `mean \|ΔP(Ŷ=1)\| on counterfactual flip` | < 0.15 = acceptable |
| **Composite Fairness Score** | `1 − [0.4·DPD + 0.4·EOV + 0.2·IDI]` | ≥ 0.70 = good |

---

## Export Outputs

### Debiased CSV (`acde_debiased_dataset.csv`)
All original columns plus:
- **`ipw_weight`** — per-row Inverse Probability Weight for use as `sample_weight` in sklearn retraining
- **`acde_mitigated`** — 1 if the post-mitigation model predicts a positive outcome for this group

Use `ipw_weight` directly:
```python
from sklearn.ensemble import RandomForestClassifier
clf = RandomForestClassifier()
clf.fit(X_train, y_train, sample_weight=df["ipw_weight"])
```

### Audit Report (`acde_bias_audit_report.txt`)
Plain-text compliance document containing:
- Dataset summary (rows, positive rate, protected attributes)
- Before/after table for all fairness metrics
- Before/after model performance (accuracy, F1, ROC-AUC)
- Group disparity tables (before and after)
- Prioritised recommendations (HIGH / MEDIUM / LOW)
- Integration note for exact per-row backend weights

---

## Known Issues & Fixes

### "Session ID not found" on Export
**Cause:** `DataPreview.js` was reading `window.sessionId` or `localStorage` instead of the `sessionId` prop.  
**Fix:** Remove the inner `const sessionId = ...` line in `handleExportCSV` so the component prop is used directly.

### Export returns only 10 rows
**Cause:** The `/export` endpoint was returning the original `df` instead of the debiased `df_w`, and `df_w` was never saved to the session.  
**Fix:** Add `"_df_w": df_w` to `run_pipeline()`'s return dict, pop it in `/analyze` and `/demo`, save to `SESSIONS[session_id]["df_w"]`, and use it in `/export`.

### `"truth value of a DataFrame is ambiguous"` error
**Cause:** `df_w or fallback` evaluates `bool(df_w)` on a DataFrame, which is ambiguous.  
**Fix:** Use `df_w if (df_w is not None) else fallback` — always use explicit `is not None` checks with DataFrames, never `or`.

### Demo mode export fails
**Cause:** `/demo` never created a session, so `/export` had nothing to look up.  
**Fix:** Generate a `session_id` in `/demo`, store `{"df": df, "df_w": df_w}` in `SESSIONS`, and include `session_id` in the response.
>>>>>>> e5f67520 (Initial commit)
