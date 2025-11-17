import mysql.connector
from mysql.connector import Error

def get_connection():
    try:
        import os

        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "recosave")
        )
        return connection
    except Error as e:
        print("MySQL Connection Error:", e)
        return None


def init_db():
    connection = get_connection()
    if connection is None:
        print("❌ Failed to connect to MySQL")
        return

    cursor = connection.cursor()

    # USERS TABLE
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        salary INT,
        age INT,
        gender VARCHAR(20),
        investment_goal VARCHAR(255)
    ) ENGINE=InnoDB;
    """)

    # ENROLLED SCHEMES TABLE
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS enrolled_schemes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        scheme_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ) ENGINE=InnoDB;
    """)

    connection.commit()
    cursor.close()
    connection.close()

    print("✅ MySQL Database initialized & tables ready!")
