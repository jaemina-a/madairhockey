import os
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from threading import Lock

class Database:
    _instance = None
    _lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_pool()
            return cls._instance

    def _init_pool(self):
        DB_CONF = dict(
            user     = os.getenv("DB_USER"),
            password = os.getenv("DB_PASSWORD"),
            host     = os.getenv("DB_HOST", "127.0.0.1"),
            database = os.getenv("DB_NAME", "airhockey"),
            use_pure = True
        )
        self.pool = mysql.connector.pooling.MySQLConnectionPool(
            pool_name="ah_pool", pool_size=5, **DB_CONF
        )

    def init_db(self):
        conn = self.pool.get_connection(); cur = conn.cursor()
        # 기존 테이블 삭제 (외래키 제약조건 때문에 순서 중요)
        cur.execute("DROP TABLE IF EXISTS user_skills")
        cur.execute("DROP TABLE IF EXISTS matches")
        cur.execute("DROP TABLE IF EXISTS users")
        cur.execute("DROP TABLE IF EXISTS skills")
        # 테이블들 다시 생성
        cur.execute("""
            CREATE TABLE users(
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(32) UNIQUE,
                pw_hash VARCHAR(255),
                created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE skills(
                id INT PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                icon VARCHAR(10) NOT NULL,
                multiplier DECIMAL(3,1) NOT NULL,
                color VARCHAR(7) NOT NULL,
                description TEXT,
                unlock_condition VARCHAR(100),
                cooldown DECIMAL(3,1) DEFAULT 3.0
            )
        """)
        cur.execute("""
            CREATE TABLE user_skills(
                user_id INT,
                skill_id INT,
                unlocked BOOLEAN DEFAULT FALSE,
                usage_count INT DEFAULT 0,
                last_used TIMESTAMP NULL,
                PRIMARY KEY (user_id, skill_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
            )
        """)
        cur.execute("""
            CREATE TABLE matches(
                id INT AUTO_INCREMENT PRIMARY KEY,
                ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                left_score INT,
                right_score INT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS match_room(
                id INT AUTO_INCREMENT PRIMARY KEY,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_playing BOOLEAN DEFAULT FALSE,
                max_player INT DEFAULT 2,
                room_name VARCHAR(50) NOT NULL,
                username VARCHAR(32) NOT NULL
            )
        """)
        # 기본 스킬 데이터 삽입 (기존 데이터 삭제 후 다시 생성)
        cur.execute("DELETE FROM skills")
        default_skills = [
            (1, "스킬 1", "⚡", 1.5, "#6366f1", "기본 속도 증가 스킬", "기본 제공", 3.0),
            (2, "스킬 2", "🔥", 2.0, "#f59e0b", "고속 공격 스킬", "기본 제공", 3.0),
            (3, "스킬 3", "💨", 2.5, "#10b981", "초고속 공격 스킬", "기본 제공", 3.0),
            (4, "스킬 4", "🚀", 3.0, "#ef4444", "최고속 공격 스킬", "기본 제공", 3.0)
        ]
        
        cur.executemany("""
            INSERT INTO skills (id, name, icon, multiplier, color, description, unlock_condition, cooldown) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, default_skills)
        print("기본 스킬 데이터를 생성했습니다.")
        # 더미 유저 생성 (없는 경우에만)
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        if user_count == 0:
            dummy_users = [
                ("player1", "password123"),
                ("player2", "password123"),
                ("player3", "password123"),
                ("test_user", "password123")
            ]
            for username, password in dummy_users:
                pw_hash = generate_password_hash(password)
                cur.execute("INSERT INTO users(username, pw_hash) VALUES (%s,%s)", (username, pw_hash))
                user_id = cur.lastrowid
                cur.execute("INSERT INTO user_skills(user_id, skill_id, unlocked) VALUES (%s, 1, TRUE), (%s, 2, TRUE)", (user_id, user_id))
                print(f"더미 유저 '{username}'을 생성하고 기본 스킬을 제공했습니다.")
        else:
            cur.execute("SELECT id FROM users")
            existing_users = cur.fetchall()
            for user in existing_users:
                user_id = user[0]
                cur.execute("DELETE FROM user_skills WHERE user_id = %s", (user_id,))
                cur.execute("INSERT INTO user_skills(user_id, skill_id, unlocked) VALUES (%s, 1, TRUE), (%s, 2, TRUE)", (user_id, user_id))
                print(f"유저 ID {user_id}에게 기본 스킬을 제공했습니다.")
        conn.commit(); cur.close(); conn.close()

    def get_user_skills(self, username):
        conn = self.pool.get_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT s.id, s.name, s.icon, s.multiplier, s.color, s.description, s.cooldown, us.unlocked, us.usage_count
            FROM users u
            INNER JOIN user_skills us ON u.id = us.user_id
            INNER JOIN skills s ON us.skill_id = s.id
            WHERE u.username = %s AND us.unlocked = TRUE
            ORDER BY s.id
        """, (username,))
        skills = cur.fetchall()
        for skill in skills:
            if 'multiplier' in skill and hasattr(skill['multiplier'], '__float__'):
                skill['multiplier'] = float(skill['multiplier'])
            if 'cooldown' in skill and hasattr(skill['cooldown'], '__float__'):
                skill['cooldown'] = float(skill['cooldown'])
            if 'usage_count' in skill and skill['usage_count'] is not None:
                skill['usage_count'] = int(skill['usage_count'])
        print(f"유저 {username}의 스킬: {[s['name'] for s in skills]}")
        cur.close(); conn.close()
        return skills

    def create_user(self, username, password):
        pw_hash = generate_password_hash(password)
        conn = self.pool.get_connection(); cur = conn.cursor()
        cur.execute("INSERT INTO users(username, pw_hash) VALUES (%s,%s)", (username, pw_hash))
        user_id = cur.lastrowid
        cur.execute("INSERT INTO user_skills(user_id, skill_id, unlocked) VALUES (%s, 1, TRUE), (%s, 2, TRUE)", (user_id, user_id))
        conn.commit(); cur.close(); conn.close()

    def verify_user(self, username, password):
        conn = self.pool.get_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT pw_hash FROM users WHERE username=%s", (username,))
        row = cur.fetchone()
        cur.close(); conn.close()
        return row and check_password_hash(row["pw_hash"], password)

    def save_match(self, g):
        conn = self.pool.get_connection(); cur = conn.cursor()
        cur.execute("INSERT INTO matches(left_score,right_score) VALUES (%s,%s)",
                    (g.score["left"], g.score["right"]))
        conn.commit(); cur.close(); conn.close()

    def make_room(self, username, room_name):
        conn = self.pool.get_connection(); cur = conn.cursor()
        if(room_name == ""):
            room_name = username + "의 방"
        cur.execute("INSERT INTO match_room(username, room_name) VALUES (%s,%s)", (username, room_name))
        print(f"방 생성: {username} - {room_name}")
        conn.commit(); cur.close(); conn.close()

    def get_room_list(self):
        print("방 목록 조회")
        conn = self.pool.get_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM match_room")
        rooms = cur.fetchall()
        cur.close(); conn.close()
        print(rooms)
        return rooms
# 싱글턴 인스턴스
DB = Database() 