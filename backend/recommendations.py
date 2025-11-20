import google.generativeai as genai
import os
import json

# Load API key from Render environment variables
API_KEY = os.getenv("GEMINI_API_KEY")  # make sure this env variable exists

MODEL = "gemini-2.0-flash"   

def generate_ai_recommendation(user_data):
    if not API_KEY:
        return {"error": "Gemini API key missing. Please set GEMINI_API_KEY in Render."}

    prompt = f"""
You are RecoSave AI, a financial advisor.

Analyze this user's profile and give 2–3 government scheme recommendations.

User Profile:
- Age: {user_data.get('age')}
- Gender: {user_data.get('gender')}
- Salary: {user_data.get('salary')}
- Investment Goal: {user_data.get('investment_goal')}

Return ONLY valid JSON in this format:

{{
  "title": "",
  "summary_advice": "",
  "recommended_schemes": [
    {{
      "scheme_name": "",
      "relevance_reason": ""
    }}
  ]
}}
"""

    try:
        model = genai.GenerativeModel(MODEL)

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )

        # Parse JSON directly from Gemini
        return json.loads(response.text)

    except Exception as e:
        print("AI Error:", str(e))
        return {"error": "Failed to generate AI recommendation."}


# --- SEARCH FUNCTION STAYS SAME ---
def find_schemes(query):
    query = query.lower()
    results = []

    SCHEMES_DATABASE = {
        "PPF": {"name": "Public Provident Fund (PPF)", "tag": "Long-Term, Tax-Free", "desc": "A popular long-term saving scheme with tax benefits under Section 80C."},
        "SCSS": {"name": "Senior Citizen's Saving Scheme (SCSS)", "tag": "Age 60+, High Interest", "desc": "Designed for retired individuals to provide a steady income stream."},
        "NSC": {"name": "National Savings Certificate (NSC)", "tag": "Fixed Income, Tax Benefit", "desc": "A fixed-income scheme that offers tax benefits and can be used as collateral."},
        "SSY": {"name": "Sukanya Samriddhi Yojana (SSY)", "tag": "Female Child, High Interest", "desc": "Exclusive scheme for the savings for a girl child's future."},
        "NPS": {"name": "National Pension System (NPS)", "tag": "Retirement, Market Linked", "desc": "Market-linked scheme for long-term retirement planning with tax benefits under Section 80CCD."},
        "AP": {"name": "Atal Pension Yojana (APY)", "tag": "Low Income, Pension", "desc": "Government scheme for workers in the unorganized sector to ensure income security after retirement."},
        "KVP": {"name": "Kisan Vikas Patra (KVP)", "tag": "Doubling, Safe", "desc": "A certificate scheme that guarantees to double the amount invested after a specified period."},
        "ELSS": {"name": "Equity Linked Savings Scheme (ELSS)", "tag": "Growth, Tax Deduction, Short Lock-in", "desc": "A type of mutual fund that qualifies for tax deductions under Section 80C, offering market-linked growth."},
        "LIC": {"name": "Life Insurance Corporation (LIC) Policies", "tag": "Insurance, Savings, Protection", "desc": "Various policies offering life coverage combined with a disciplined savings component."},
        "FD": {"name": "Tax Saving Fixed Deposit (FD)", "tag": "Safe, Tax Deduction, 5-Year Lock-in", "desc": "A special type of bank Fixed Deposit that provides a fixed return while qualifying for tax benefits."},
        "PMVVY": {"name": "Pradhan Mantri Vaya Vandana Yojana (PMVVY)", "tag": "Age 60+, Pension, Safe", "desc": "A pension scheme exclusively for senior citizens, providing an assured return based on the purchase price."},
        "PMSBY": {"name": "Pradhan Mantri Suraksha Bima Yojana (PMSBY)", "tag": "Insurance, Low Premium, Accident", "desc": "A low-cost accident insurance scheme for Indian citizens, covering accidental death and disability."},
        "PMJJBY": {"name": "Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)", "tag": "Insurance, Low Premium, Life", "desc": "A government-backed life insurance scheme providing life cover for one year, renewable annually."},
        "PMJDY": {"name": "Pradhan Mantri Jan Dhan Yojana (PMJDY)", "tag": "Zero Balance, Bank Account", "desc": "National mission for financial inclusion to ensure access to financial services like banking, savings, and credit."},
        "SGB": {"name": "Sovereign Gold Bond (SGB)", "tag": "Gold Investment, Tax Efficient", "desc": "Government securities denominated in grams of gold, offering safety and an interest rate, ideal for long-term gold exposure."},
        "POMIS": {"name": "Post Office Monthly Income Scheme (POMIS)", "tag": "Monthly Income, Low Risk", "desc": "A popular scheme providing fixed monthly income with a low-risk profile, ideal for steady returns."},
        # --- VPF AND EPF SCHEMES ADDED BELOW ---
        "VPF": {"name": "Voluntary Provident Fund (VPF)", "tag": "Extra Savings, Tax-Free, Salaried", "desc": "Allows salaried employees to voluntarily contribute over the mandatory EPF limit for higher interest and tax-free accumulation."},
        "EPF": {"name": "Employee Provident Fund (EPF)", "tag": "Mandatory Savings, Tax-Free, Salaried", "desc": "A compulsory retirement savings scheme for salaried employees with mandated contributions from both employer and employee."}
    }

    for scheme_key, details in SCHEMES_DATABASE.items():
        search_text = (scheme_key + details["name"] + details["tag"] + details["desc"]).lower()
        if query in search_text:
            results.append({
                "scheme_name": details["name"],
                "short_description": details["desc"],
                "key_benefit": details["tag"]
            })

    return results
