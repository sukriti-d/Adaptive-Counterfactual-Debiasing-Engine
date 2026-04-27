"""
visualizer.py  –  ACDE Publication-Quality Figures
=======================================================================
Generates a multi-panel PDF / PNG summary
or an executive dashboard.  All figures are saved to 'acde_figures.pdf'.

Figure layout (4 panels)
────────────────────────
  1. Group Positive Rates – Before vs After  (grouped bar chart)
  2. Fairness Metrics Radar                  (spider / radar chart)
  3. Instability per Demographic Group       (horizontal bar chart)
  4. Fairness–Utility Tradeoff Table         (formatted table panel)
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.gridspec import GridSpec
from typing import Optional


# ──────────────────────────────────────────────────────────────────────────────
# Style
# ──────────────────────────────────────────────────────────────────────────────

PALETTE = {
    "before":    "#E05C5C",
    "after":     "#4A90D9",
    "neutral":   "#7CB9A8",
    "dark":      "#2C3E50",
    "light_bg":  "#F8F9FA",
    "grid":      "#DDEEFF",
}

plt.rcParams.update({
    "font.family":      "DejaVu Sans",
    "font.size":        10,
    "axes.titlesize":   11,
    "axes.labelsize":   9,
    "axes.titleweight": "bold",
    "axes.spines.top":  False,
    "axes.spines.right": False,
    "figure.dpi":       150,
})


# ──────────────────────────────────────────────────────────────────────────────
# Individual panels
# ──────────────────────────────────────────────────────────────────────────────

def _panel_group_rates(ax, bias_before: pd.DataFrame, bias_after: pd.DataFrame):
    groups = bias_before["group"].tolist()
    x = np.arange(len(groups))
    w = 0.35

    ax.bar(x - w/2, bias_before["positive_rate"], w,
           color=PALETTE["before"], label="Before", alpha=0.85, zorder=3)
    ax.bar(x + w/2, bias_after["positive_rate"], w,
           color=PALETTE["after"],  label="After",  alpha=0.85, zorder=3)

    # Overall positive rate reference line
    overall = bias_before["positive_rate"].mean()
    ax.axhline(overall, color=PALETTE["dark"], lw=1.2, ls="--", alpha=0.6,
               zorder=2, label=f"Overall mean ({overall:.2f})")

    ax.set_xticks(x)
    ax.set_xticklabels(groups, rotation=25, ha="right", fontsize=8)
    ax.set_ylabel("Positive Prediction Rate")
    ax.set_title("Group Positive Rates — Before vs After Mitigation")
    ax.set_ylim(0, 1.05)
    ax.yaxis.grid(True, color=PALETTE["grid"], zorder=0)
    ax.legend(fontsize=8)


def _panel_radar(ax, metrics_before: dict, metrics_after: dict):
    """Radar chart of normalised fairness metrics (lower = worse)."""
    labels = ["DPD", "EOV", "PPD", "1−DIR"]
    keys   = ["demographic_parity_difference",
              "equalized_odds_violation",
              "predictive_parity_difference",
              "disparate_impact_ratio"]

    def extract(m):
        vals = []
        for k in keys:
            v = m.get(k, 0.0)
            if k == "disparate_impact_ratio":
                v = 1.0 - (v if not np.isnan(v) else 1.0)   # invert: higher = worse
            vals.append(float(v) if not np.isnan(v) else 0.0)
        return vals

    before_vals = extract(metrics_before)
    after_vals  = extract(metrics_after)
    n = len(labels)
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()

    # Close the polygon
    before_vals += [before_vals[0]]
    after_vals  += [after_vals[0]]
    angles      += [angles[0]]
    label_angles = angles[:-1]

    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_xticks(label_angles)
    ax.set_xticklabels(labels, size=9)
    ax.set_ylim(0, max(max(before_vals), max(after_vals), 0.6))
    ax.yaxis.grid(True, color=PALETTE["grid"])
    ax.xaxis.grid(True, color=PALETTE["grid"])

    ax.plot(angles, before_vals, "o-", lw=2,  color=PALETTE["before"], label="Before")
    ax.fill(angles, before_vals, alpha=0.15,  color=PALETTE["before"])
    ax.plot(angles, after_vals,  "o-", lw=2,  color=PALETTE["after"],  label="After")
    ax.fill(angles, after_vals,  alpha=0.15,  color=PALETTE["after"])
    ax.set_title("Fairness Metrics Radar\n(lower = more biased)", pad=14)
    ax.legend(loc="upper right", bbox_to_anchor=(1.35, 1.1), fontsize=8)


def _panel_instability(ax, inst_before: pd.DataFrame, inst_after: pd.DataFrame):
    groups = inst_before["group"].tolist()
    y = np.arange(len(groups))
    h = 0.35

    bvals = inst_before["instability_rate"].values
    avals = inst_after.set_index("group").reindex(groups)["instability_rate"].fillna(0).values

    ax.barh(y + h/2, bvals, h, color=PALETTE["before"], label="Before", alpha=0.85, zorder=3)
    ax.barh(y - h/2, avals, h, color=PALETTE["after"],  label="After",  alpha=0.85, zorder=3)

    ax.set_yticks(y)
    ax.set_yticklabels(groups, fontsize=8)
    ax.set_xlabel("Counterfactual Flip Rate")
    ax.set_title("Instability per Demographic Group")
    ax.xaxis.grid(True, color=PALETTE["grid"], zorder=0)
    ax.legend(fontsize=8)


def _panel_table(ax, summary: dict):
    ax.axis("off")
    ax.set_facecolor(PALETTE["light_bg"])

    rows = [
        ["Metric", "Before", "After", "Δ"],
        ["Accuracy",
         f"{summary['acc_before']:.4f}",
         f"{summary['acc_after']:.4f}",
         _delta(summary['acc_after'], summary['acc_before'])],
        ["Fairness Score",
         f"{summary['fs_before']:.4f}",
         f"{summary['fs_after']:.4f}",
         _delta(summary['fs_after'], summary['fs_before'])],
        ["Max Disparity",
         f"{summary['disp_before']:.4f}",
         f"{summary['disp_after']:.4f}",
         _delta(summary['disp_after'], summary['disp_before'], invert=True)],
        ["Flip Rate",
         f"{summary['inst_before']:.4f}",
         f"{summary['inst_after']:.4f}",
         _delta(summary['inst_after'], summary['inst_before'], invert=True)],
        ["DPD",
         f"{summary.get('dpd_before', 0):.4f}",
         f"{summary.get('dpd_after', 0):.4f}",
         _delta(summary.get('dpd_after', 0), summary.get('dpd_before', 0), invert=True)],
        ["Bias Reduction %", "—", "—",
         f"{summary.get('bias_reduction', 0):.1f} %"],
    ]

    col_widths = [0.38, 0.18, 0.18, 0.26]
    x_starts   = [0.02, 0.42, 0.62, 0.82]
    row_height = 0.12
    y_start    = 0.95

    for r_idx, row in enumerate(rows):
        y = y_start - r_idx * row_height
        is_header = r_idx == 0
        for c_idx, cell in enumerate(row):
            color = PALETTE["dark"] if is_header else "black"
            weight = "bold" if is_header else "normal"
            bg = PALETTE["after"] + "33" if is_header else (
                 "#F0F4F8" if r_idx % 2 == 0 else "white")
            ax.text(x_starts[c_idx], y, cell,
                    transform=ax.transAxes,
                    fontsize=9, color=color, fontweight=weight,
                    verticalalignment="top")
        # Row background strip
        ax.axhline(y - 0.01, xmin=0.01, xmax=0.99,
                   color=PALETTE["grid"], lw=0.5)

    ax.set_title("Fairness–Utility Tradeoff Summary", fontsize=11, fontweight="bold")


def _delta(new, old, invert=False):
    diff = new - old
    if invert:
        symbol = "▼" if diff < 0 else ("▲" if diff > 0 else "—")
        return f"{symbol} {abs(diff):.4f}"
    else:
        symbol = "▲" if diff > 0 else ("▼" if diff < 0 else "—")
        return f"{symbol} {abs(diff):.4f}"


# ──────────────────────────────────────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────────────────────────────────────

def generate_figures(
    bias_before:   pd.DataFrame,
    bias_after:    pd.DataFrame,
    inst_before:   pd.DataFrame,
    inst_after:    pd.DataFrame,
    metrics_before: dict,
    metrics_after:  dict,
    summary:        dict,
    output_path:    str = "acde_figures.png",
):
    fig = plt.figure(figsize=(16, 11), facecolor="white")
    fig.suptitle(
        "ACDE — Adaptive Counterfactual Debiasing Engine  |  Audit Dashboard",
        fontsize=14, fontweight="bold", y=0.98, color=PALETTE["dark"]
    )

    gs = GridSpec(2, 2, figure=fig, hspace=0.42, wspace=0.35,
                  left=0.07, right=0.97, top=0.93, bottom=0.06)

    ax1 = fig.add_subplot(gs[0, 0])
    ax2 = fig.add_subplot(gs[0, 1], polar=True)
    ax3 = fig.add_subplot(gs[1, 0])
    ax4 = fig.add_subplot(gs[1, 1])

    _panel_group_rates(ax1, bias_before, bias_after)
    _panel_radar(ax2, metrics_before, metrics_after)
    _panel_instability(ax3, inst_before, inst_after)
    _panel_table(ax4, summary)

    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Figures saved → {output_path}")