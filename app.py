import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
from www.database import init_db, get_db_connection
from www.recommendations import generate_ai_recommendation, find_schemes

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize DB once at startup
init_db()


# ---------------- UTILITY FUNCTION ----------------
def execute_db_query(query, params=(), fetch_one=False):
    """Executes a database query and returns fetched results (if applicable)."""
    conn = get_db_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(query, params)
        conn.commit()
        if fetch_one:
            return cursor.fetchone()
        return cursor.fetchall()
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise e
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# ---------------- API ROUTES ----------------

@app.route('/')
def home():
    return jsonify({"message": "RecoSave AI Backend is Running. Use API endpoints for functionality."}), 200


# ---------------- USER AUTH ----------------

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    salary = data.get('salary')
    age = data.get('age')
    gender = data.get('gender')
    investment_goal = data.get('investment_goal')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    try:
        query = """
        INSERT INTO users (username, password, salary, age, gender, investment_goal)
        VALUES (?, ?, ?, ?, ?, ?)
        """
        execute_db_query(query, (username, password, salary, age, gender, investment_goal))

        user = execute_db_query("SELECT id FROM users WHERE username = ?", (username,), fetch_one=True)
        new_user_id = user["id"]
        return jsonify({"message": "User registered successfully!", "user_id": new_user_id}), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    query = "SELECT id FROM users WHERE username = ? AND password = ?"
    user = execute_db_query(query, (username, password), fetch_one=True)

    if user:
        return jsonify({"message": "Login successful!", "user_id": user["id"]}), 200
    else:
        return jsonify({"error": "Invalid username or password"}), 401


# ---------------- USER DATA UPDATE ----------------

@app.route('/salary_input', methods=['POST'])
def salary_input():
    data = request.json
    user_id = data.get('user_id')
    salary = data.get('salary')
    age = data.get('age')
    gender = data.get('gender')
    investment_goal = data.get('investment_goal')

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    try:
        query = """
        UPDATE users
        SET salary = ?, age = ?, gender = ?, investment_goal = ?
        WHERE id = ?
        """
        execute_db_query(query, (salary, age, gender, investment_goal, user_id))
        return jsonify({"message": "User data updated successfully!"}), 200
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


# ---------------- ENROLLMENT ROUTES (Persistent Save) ----------------

@app.route('/enroll_scheme', methods=['POST'])
def enroll_scheme():
    """Saves a scheme enrollment persistently for a user."""
    data = request.json
    user_id = data.get('user_id')
    scheme_name = data.get('scheme_name')

    if not user_id or not scheme_name:
        return jsonify({"error": "User ID and scheme name are required."}), 400

    try:
        # Prevent duplicates
        existing = execute_db_query(
            "SELECT * FROM enrollments WHERE user_id = ? AND scheme_name = ?",
            (user_id, scheme_name),
            fetch_one=True,
        )
        if existing:
            return jsonify({"error": f"Scheme '{scheme_name}' is already enrolled."}), 409

        execute_db_query(
            "INSERT INTO enrollments (user_id, scheme_name) VALUES (?, ?)",
            (user_id, scheme_name),
        )
        return jsonify({"message": f"Scheme '{scheme_name}' enrolled successfully."}), 201

    except Exception as e:
        return jsonify({"error": f"Failed to enroll scheme: {str(e)}"}), 500


@app.route('/get_enrollments/<int:user_id>', methods=['GET'])
def get_enrollments(user_id):
    """Retrieves all enrolled schemes for a user."""
    try:
        results = execute_db_query(
            "SELECT scheme_name FROM enrollments WHERE user_id = ?", (user_id,)
        )
        schemes = [row["scheme_name"] for row in results]
        return jsonify({"enrolled_schemes": schemes}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve enrollments: {str(e)}"}), 500


# ---------------- AI RECOMMENDATION ----------------

@app.route('/recommendations/<int:user_id>', methods=['GET'])
def get_recommendations(user_id):
    query = "SELECT salary, age, gender, investment_goal FROM users WHERE id = ?"
    user_data = execute_db_query(query, (user_id,), fetch_one=True)

    if not user_data:
        return jsonify({"error": "User not found"}), 404

    user_data_dict = dict(user_data)

    if not all(
        [user_data_dict.get("age"), user_data_dict.get("salary"), user_data_dict.get("investment_goal")]
    ):
        return jsonify(
            {"error": "Missing essential profile data (salary, age, or goal) required for AI analysis."}
        ), 400

    ai_response = generate_ai_recommendation(user_data_dict)
    if "error" in ai_response:
        return jsonify(ai_response), 500

    return jsonify({"recommendation_analysis": ai_response}), 200


# ---------------- SCHEME SEARCH ----------------

@app.route('/search', methods=['GET'])
def search_schemes():
    query = request.args.get('q')
    if not query:
        return jsonify({"results": [], "message": "Enter a search term (e.g., 'tax', 'age 60')."}), 200

    results = find_schemes(query)
    return jsonify({"results": results}), 200


# ---------------- USER PROFILE ----------------

@app.route('/user_profile/<int:user_id>', methods=['GET'])
def user_profile(user_id):
    query = "SELECT id, username, salary, age, gender, investment_goal FROM users WHERE id = ?"
    user = execute_db_query(query, (user_id,), fetch_one=True)

    if user:
        return jsonify(dict(user)), 200
    else:
        return jsonify({"error": "User not found"}), 404
    
@app.route('/change_password', methods=['POST'])
def change_password():
    """
    Handles user password change request.
    """
    data = request.json
    user_id = data.get('user_id')
    new_password = data.get('new_password')

    if not user_id or not new_password:
        return jsonify({"error": "User ID and new password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if user exists first
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if cursor.fetchone() is None:
            return jsonify({"error": "User not found"}), 404
        
        # Update the password
        update_query = "UPDATE users SET password = ? WHERE id = ?"
        cursor.execute(update_query, (new_password, user_id))
        conn.commit()
        
        return jsonify({"message": "Password updated successfully! Please re-login."}), 200
    except sqlite3.OperationalError as e:
        return jsonify({"error": f"Database error during password change: {str(e)}"}), 500
    finally:
        conn.close()


# ---------------- MAIN ----------------
if __name__ == '__main__':
    # Change 'debug=True' to this line:
    app.run(host='0.0.0.0', port=5000, debug=True)