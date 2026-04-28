"""
gemini_advisor.py — AI-powered bias analysis using Google Gemini (new SDK)
"""
import os
import json
import re
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

client = genai.GenerativeModel("gemini-1.5-flash")

def generate_bias_advisory(result: dict) -> dict:
    before = result.get("before", {})
    after  = result.get("after", {})
    attrs  = result.get("protected_attributes", [])
    comp   = result.get("comparison", {})

    prompt = f"""
You are a responsible AI fairness auditor. Analyze this bias audit result and provide a structured response.

Audit Data:
- Protected attributes: {attrs}
- Dataset size: {result.get("n_rows")} rows
- Before mitigation — Fairness Score: {before.get("fairness_score")}, Flip Rate: {before.get("instability", {}).get("flip_rate")}, DPD: {before.get("metrics", {}).get("demographic_parity_difference")}
- After mitigation  — Fairness Score: {after.get("fairness_score")}, Flip Rate: {after.get("instability", {}).get("flip_rate")}, DPD: {after.get("metrics", {}).get("demographic_parity_difference")}
- Bias reduction: {comp.get("bias_reduction")}%
- Accuracy cost: {comp.get("accuracy_cost")}
- Disparate Impact Ratio (before): {before.get("metrics", {}).get("disparate_impact_ratio")}
- Disparate Impact Ratio (after): {after.get("metrics", {}).get("disparate_impact_ratio")}

Respond ONLY with a valid JSON object — no markdown, no backticks, no preamble. Use exactly these keys:
{{
  "summary": "2-3 sentence plain English summary for non-technical stakeholders",
  "legal_risk": {{
    "level": "HIGH or MEDIUM or LOW",
    "detail": "Reference EEOC 4/5ths rule and EU AI Act where relevant"
  }},
  "recommendations": [
    {{"priority": "HIGH", "action": "...", "reason": "..."}},
    {{"priority": "HIGH", "action": "...", "reason": "..."}},
    {{"priority": "MEDIUM", "action": "...", "reason": "..."}}
  ],
  "improvements": "What improved after mitigation, 2-3 sentences",
  "concerns": "What still needs attention, 2-3 sentences"
}}
"""

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=prompt,
    )

    text = response.text.strip()
    # Strip markdown code fences if model adds them anyway
    text = re.sub(r"^```json|^```|```$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)
