import json
import requests
import time

# NOTE: The API key is automatically handled by the environment.
API_KEY = "AIzaSyBsNZhcLD_LOI6bF0qmCVU9RSxsuReT7M4" 
GEMINI_MODEL_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={API_KEY}"

def call_gemini_api(payload):
    """
    Handles the POST request to the Gemini API with retries (exponential backoff).
    """
    headers = {'Content-Type': 'application/json'}
    max_retries = 5
    initial_delay = 1  # seconds

    for attempt in range(max_retries):
        try:
            # Set a timeout for the external API call
            response = requests.post(GEMINI_MODEL_URL, headers=headers, data=json.dumps(payload), timeout=45) 
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429 and attempt < max_retries - 1:
                # Handle rate limiting
                delay = initial_delay * (2 ** attempt)
                time.sleep(delay)
            else:
                print(f"HTTP Error: {e}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"Request Error: {e}")
            return None
    return None

def generate_ai_recommendation(user_data):
    """
    Generates a structured, conversational recommendation using the Gemini API.
    """
    system_prompt = (
        "You are 'RecoSave AI', an expert financial advisor specializing in government savings schemes for salaried individuals in India. "
        "Your goal is to analyze the user's profile data (salary, age, gender, and goal) and provide personalized advice. "
        "Critically evaluate the schemes that are most relevant to their specific demographics and needs. "
        "Your final output MUST strictly adhere to the provided JSON schema."
    )

    user_query = (
        f"Analyze the following user profile data and provide a personalized financial consultation and scheme recommendation. "
        f"User Profile: "
        f"  - Age: {user_data.get('age')} years\n"
        f"  - Gender: {user_data.get('gender')}\n"
        f"  - Monthly Salary (Gross): {user_data.get('salary')}\n"
        f"  - Investment Goal: {user_data.get('investment_goal')}\n\n"
        f"Based on this, recommend 2-3 government savings schemes. For each, provide a brief, easy-to-understand explanation of why it is a good fit for this specific user's age, gender, and salary bracket."
    )

    response_schema = {
        "type": "OBJECT",
        "properties": {
            "title": {"type": "STRING", "description": "A compelling, personalized title for the financial advice."},
            "summary_advice": {"type": "STRING", "description": "A 2-3 sentence conversational summary of the overall financial strategy."},
            "recommended_schemes": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "scheme_name": {"type": "STRING", "description": "The name of the government savings scheme (e.g., PPF, SCSS)."},
                        "relevance_reason": {"type": "STRING", "description": "A concise explanation (1-2 sentences) of why this scheme specifically matches the user's profile."}
                    },
                    "propertyOrdering": ["scheme_name", "relevance_reason"]
                }
            }
        },
        "propertyOrdering": ["title", "summary_advice", "recommended_schemes"]
    }

    payload = {
        "contents": [{"parts": [{"text": user_query}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": response_schema
        }
    }

    api_response = call_gemini_api(payload)
    
    if api_response and 'candidates' in api_response and api_response['candidates']:
        try:
            json_string = api_response['candidates'][0]['content']['parts'][0]['text']
            return json.loads(json_string)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error parsing AI response: {e}")
            return {"error": "Failed to generate structured AI response."}
    
    return {"error": "Failed to get a valid response from the AI model."}

# Simple search function for the search page (Android-specific feature)
def find_schemes(query):
    query = query.lower()
    results = []
    
    # --- EXPANDED SEARCH DATABASE (18 SCHEMES) ---
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
    # --- END EXPANDED SEARCH DATABASE ---
    
    for scheme_key, details in SCHEMES_DATABASE.items():
        # Check if the query is in the name, description, or benefits
        search_fields = (
            scheme_key.lower() + 
            details["name"].lower() + 
            details["tag"].lower() + 
            details["desc"].lower()
        )
        
        if query in search_fields:
            # Return a simplified structure for the search results card
            results.append({
                "scheme_name": details["name"],
                "short_description": details["desc"],
                "key_benefit": details["tag"]
            })
    return results
