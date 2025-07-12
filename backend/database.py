import os
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector

# ─────────── DB 설정 ───────────
DB_CONF = dict(
    user     = os.getenv("DB_USER"),                # .env에서 읽음
    password = os.getenv("DB_PASSWORD"),
    host     = os.getenv("DB_HOST", "127.0.0.1"),
    database = os.getenv("DB_NAME", "airhockey"),
    use_pure = True
)
pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="ah_pool", pool_size=5, **DB_CONF
)

def init_db():
    conn = pool.get_connection(); cur = conn.cursor()
    
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
            unlock_condition VARCHAR(100)
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
    
    # 기본 스킬 데이터 삽입 (기존 데이터 삭제 후 다시 생성)
    cur.execute("DELETE FROM skills")
    default_skills = [
        (1, "스킬 1", "⚡", 1.5, "#6366f1", "기본 속도 증가 스킬", "기본 제공"),
        (2, "스킬 2", "🔥", 2.0, "#f59e0b", "고속 공격 스킬", "기본 제공"),
        (3, "스킬 3", "💨", 2.5, "#10b981", "초고속 공격 스킬", "기본 제공"),
        (4, "스킬 4", "🚀", 3.0, "#ef4444", "최고속 공격 스킬", "기본 제공")
    ]
    cur.executemany("""
        INSERT INTO skills (id, name, icon, multiplier, color, description, unlock_condition) 
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, default_skills)
    print("기본 스킬 데이터를 생성했습니다.")
    
    # 더미 유저 생성 (없는 경우에만)
    cur.execute("SELECT COUNT(*) FROM users")
    user_count = cur.fetchone()[0]
    
    if user_count == 0:
        # 더미 유저들 생성
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
            # 기본 스킬 1, 2번 제공
            cur.execute("INSERT INTO user_skills(user_id, skill_id, unlocked) VALUES (%s, 1, TRUE), (%s, 2, TRUE)", (user_id, user_id))
            print(f"더미 유저 '{username}'을 생성하고 기본 스킬을 제공했습니다.")
    else:
        # 기존 유저들에게 기본 스킬 제공
        cur.execute("SELECT id FROM users")
        existing_users = cur.fetchall()
        for user in existing_users:
            user_id = user[0]
            # 이미 기본 스킬을 가지고 있는지 확인
            cur.execute("SELECT COUNT(*) FROM user_skills WHERE user_id = %s AND skill_id IN (1, 2)", (user_id,))
            skill_count = cur.fetchone()[0]
            if skill_count == 0:
                cur.execute("INSERT INTO user_skills(user_id, skill_id, unlocked) VALUES (%s, 1, TRUE), (%s, 2, TRUE)", (user_id, user_id))
                print(f"유저 ID {user_id}에게 기본 스킬을 제공했습니다.")
            else:
                print(f"유저 ID {user_id}는 이미 기본 스킬을 가지고 있습니다.")
    
    conn.commit(); cur.close(); conn.close()

def get_user_skills(username):
    """유저가 소유한 스킬 목록 반환"""
    conn = pool.get_connection(); cur = conn.cursor(dictionary=True)
    
    # 유저의 스킬 목록 조회
    cur.execute("""
        SELECT s.id, s.name, s.icon, s.multiplier, s.color, s.description, us.unlocked, us.usage_count
        FROM users u
        INNER JOIN user_skills us ON u.id = us.user_id
        INNER JOIN skills s ON us.skill_id = s.id
        WHERE u.username = %s AND us.unlocked = TRUE
        ORDER BY s.id
    """, (username,))
    
    skills = cur.fetchall()
    
    # Decimal 타입을 float로 변환하여 JSON 직렬화 가능하게 만들기
    for skill in skills:
        if 'multiplier' in skill and hasattr(skill['multiplier'], '__float__'):
            skill['multiplier'] = float(skill['multiplier'])
        if 'usage_count' in skill and skill['usage_count'] is not None:
            skill['usage_count'] = int(skill['usage_count'])
    
    print(f"유저 {username}의 스킬: {[s['name'] for s in skills]}")
    cur.close(); conn.close()
    return skills

def create_user(username, password):
    pw_hash = generate_password_hash(password)
    conn = pool.get_connection(); cur = conn.cursor()
    
    # 유저 생성
    cur.execute("INSERT INTO users(username, pw_hash) VALUES (%s,%s)", (username, pw_hash))
    user_id = cur.lastrowid
    
    # 기본 스킬 1, 2번 제공
    cur.execute("INSERT INTO user_skills(user_id, skill_id, unlocked) VALUES (%s, 1, TRUE), (%s, 2, TRUE)", (user_id, user_id))
    
    conn.commit(); cur.close(); conn.close()

def verify_user(username, password):
    conn = pool.get_connection(); cur = conn.cursor(dictionary=True)
    cur.execute("SELECT pw_hash FROM users WHERE username=%s", (username,))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row and check_password_hash(row["pw_hash"], password)

def save_match(g):
    conn = pool.get_connection(); cur = conn.cursor()
    cur.execute("INSERT INTO matches(left_score,right_score) VALUES (%s,%s)",
                (g.score["left"], g.score["right"]))
    conn.commit(); cur.close(); conn.close() 