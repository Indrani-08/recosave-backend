# app.py (updated — uses scheme_name for enrollments)
from flask import Flask, request, jsonify
from flask_cors import CORS
from database import get_connection, init_db
from recommendations import generate_ai_recommendation, find_schemes
import mysql.connector

app = Flask(__name__)
CORS(app,  supports_credentials=True,resources={r"/*": {"origins": "*"}})

# Initialize DB (your init_db may be a no-op if you manage tables manually)
init_db()


def execute_db_query(query, params=(), fetch_one=False):
    """
    MySQL helper:
    - For SELECT queries: fetch rows (no commit)
    - For INSERT/UPDATE/DELETE: commit and return True
    """
    conn = get_connection()
    if conn is None:
        raise RuntimeError("DB connection failed")
    cursor = conn.cursor()
    try:
        cursor.execute(query, params)

        is_select = query.strip().lower().startswith("select")
        if is_select:
            result = cursor.fetchone() if fetch_one else cursor.fetchall()
            return result
        else:
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


@app.route('/')
def home():
    return jsonify({"message": "RecoSave AI Backend Running"}), 200


# -------- Authentication and profile endpoints (unchanged semantics) --------

@app.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")
    salary = data.get("salary")
    age = data.get("age")
    gender = data.get("gender")
    goal = data.get("investment_goal")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    try:
        execute_db_query("""
            INSERT INTO users (username, password, salary, age, gender, investment_goal)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (username, password, salary, age, gender, goal))
        row = execute_db_query("SELECT id FROM users WHERE username=%s", (username,), fetch_one=True)
        return jsonify({"message": "Registered!", "user_id": row[0]}), 201
    except mysql.connector.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")

    row = execute_db_query("SELECT id FROM users WHERE username=%s AND password=%s", (username, password), fetch_one=True)
    if row:
        return jsonify({"message": "Login OK", "user_id": row[0]}), 200
    return jsonify({"error": "Invalid credentials"}), 401


@app.route('/salary_input', methods=['POST'])
def salary_input():
    data = request.json or {}
    user_id = data.get("user_id")
    salary = data.get("salary")
    age = data.get("age")
    gender = data.get("gender")
    goal = data.get("investment_goal")

    if not user_id:
        return jsonify({"error": "User ID required"}), 400

    try:
        execute_db_query("""
            UPDATE users SET salary=%s, age=%s, gender=%s, investment_goal=%s WHERE id=%s
        """, (salary, age, gender, goal, user_id))
        return jsonify({"message": "Updated!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/user_profile/<int:user_id>', methods=['GET'])
def user_profile(user_id):
    row = execute_db_query("SELECT id, username, salary, age, gender, investment_goal FROM users WHERE id=%s", (user_id,), fetch_one=True)
    if not row:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id": row[0],
        "username": row[1],
        "salary": row[2],
        "age": row[3],
        "gender": row[4],
        "investment_goal": row[5]
    }), 200


# -------- Enrollments: store scheme_name (string) instead of scheme_id --------

@app.route('/enroll_scheme', methods=['POST'])
def enroll_scheme():
    """
    Expects JSON: { "user_id": <int>, "scheme_name": "<string>" }
    """
    data = request.json or {}
    user_id = data.get("user_id")
    scheme_name = data.get("scheme_name")

    if not user_id or not scheme_name:
        return jsonify({"error": "User ID and scheme name are required."}), 400

    try:
        existing = execute_db_query(
            "SELECT id FROM enrolled_schemes WHERE user_id=%s AND scheme_name=%s",
            (user_id, scheme_name), fetch_one=True
        )
        if existing:
            return jsonify({"message": "Scheme already enrolled."}), 200

        execute_db_query(
            "INSERT INTO enrolled_schemes (user_id, scheme_name) VALUES (%s, %s)",
            (user_id, scheme_name)
        )

        return jsonify({"message": "Scheme enrolled successfully."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/get_enrollments/<int:user_id>', methods=['GET'])
def get_enrollments(user_id):
    """
    Returns a list of enrolled schemes for the user, enriched with data from recommendations.find_schemes()
    Each item: { "scheme_name": ..., "category": ..., "description": ..., "created_at": ... }
    """
    try:
        rows = execute_db_query("SELECT scheme_name, created_at FROM enrolled_schemes WHERE user_id=%s ORDER BY created_at DESC", (user_id,))
        enrolled = []
        for r in rows:
            scheme_name = r[0]
            created_at = r[1].isoformat() if hasattr(r[1], 'isoformat') else str(r[1])

            # Try to fetch details from recommendations.find_schemes()
            details = find_schemes(scheme_name)  # returns list of matches
            info = {}
            if details:
                # find exact name match (case-insensitive) else pick first
                match = None
                for d in details:
                    # recommendations.find_schemes uses 'name' or 'scheme_name' keys depending on implementation;
                    # handle both possibilities
                    name_field = d.get("scheme_name") or d.get("name") or ""
                    if name_field.lower() == scheme_name.lower():
                        match = d
                        break
                if not match:
                    match = details[0]
                info["scheme_name"] = match.get("scheme_name") or match.get("name") or scheme_name
                info["category"] = match.get("key_benefit") or match.get("category") or None
                info["description"] = match.get("short_description") or match.get("desc") or match.get("description") or ""
            else:
                info["scheme_name"] = scheme_name
                info["category"] = None
                info["description"] = ""

            info["created_at"] = created_at
            enrolled.append(info)

        return jsonify({"enrolled_schemes": enrolled}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------- Search uses recommendations.find_schemes (keeps using the static DB in recommendations.py) --------

@app.route('/search', methods=['GET'])
def search_schemes():
    q = request.args.get('q', '') or ''
    try:
        results = find_schemes(q)
        # Ensure consistent keys expected by frontend: id (if available), scheme_name, short_description, key_benefit
        normalized = []
        for r in results:
            # if r already has id or name keys, keep them; else create a stable id = None
            normalized.append({
                "id": r.get("id"),  # may be None since we're not using DB ids anymore
                "scheme_name": r.get("scheme_name") or r.get("name"),
                "short_description": r.get("short_description") or r.get("desc") or r.get("description") or "",
                "key_benefit": r.get("key_benefit") or r.get("tag") or r.get("category") or ""
            })
        return jsonify({"results": normalized}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------- AI recommendation (unchanged) --------

@app.route('/recommendations/<int:user_id>', methods=['GET'])
def recommendations(user_id):
    row = execute_db_query("SELECT salary, age, gender, investment_goal FROM users WHERE id=%s", (user_id,), fetch_one=True)
    if not row:
        return jsonify({"error": "User not found"}), 404

    user_data = {
        "salary": row[0],
        "age": row[1],
        "gender": row[2],
        "investment_goal": row[3]
    }

    ai = generate_ai_recommendation(user_data)
    return jsonify({"recommendation_analysis": ai}), 200


# -------- Change password (unchanged) --------
@app.route('/change_password', methods=['POST'])
def change_password():
    data = request.json or {}
    user_id = data.get('user_id')
    new_pass = data.get('new_password')

    if not user_id or not new_pass:
        return jsonify({"error": "user_id and new_password required"}), 400

    try:
        execute_db_query("UPDATE users SET password=%s WHERE id=%s", (new_pass, user_id))
        return jsonify({"message": "Password updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.after_request
def apply_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
