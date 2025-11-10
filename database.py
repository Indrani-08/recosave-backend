import sqlite3

DATABASE = 'recosave.db'

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    # 1. Main Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            salary INTEGER,
            age INTEGER,
            gender TEXT,
            investment_goal TEXT
        );
    ''')

    # 2. Permanent Enrollments Table
    # CRITICAL FIX: The UNIQUE constraint ensures a scheme is saved only once per user.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            scheme_name TEXT NOT NULL,
            UNIQUE (user_id, scheme_name),
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

if __name__ == '__main__':
    init_db()
    print("Database initialized and 'users' and 'enrollments' tables created.")