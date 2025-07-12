# backend/app.py
import os, random
from threading import Lock

from dotenv import load_dotenv
load_dotenv()                         # .env 파일 읽기

from flask import Flask, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room
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

# ─────────── Flask + Socket.IO ───────────
app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "default-secret-key")   # 세션 서명에 사용
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# CORS 헤더 추가
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# ─────────── 게임 로직 ───────────
class Game:
    W, H = 400, 700
    PR = 15     # 패들 반지름 (원형)
    BR = 12     # 공 반지름
    SPD, TICK = 7, 1/60         # 픽셀/frame, 60 fps
    
    # 골대 설정
    GOAL_WIDTH = 121  # 골대 폭
    GOAL_HEIGHT = 20  # 골대 높이

    def __init__(self, room):
        self.room = room
        self.reset_ball(random.choice([-1, 1]))
        # 패들을 원형으로 변경 - 중앙 좌표로 저장
        self.paddle = {
            "top": {"x": self.W//2, "y": 30},      # 위쪽 패들
            "bottom": {"x": self.W//2, "y": self.H-30}  # 아래쪽 패들
        }
        self.score  = {"top": 0, "bottom": 0}
        # 스킬 관련 상태 - 각 플레이어별로 활성화된 스킬 번호 (0은 비활성화)
        self.active_skill = {"top": 0, "bottom": 0}
        self.base_speed = self.SPD
        # 플레이어별 스킬 정보
        self.player_skills = {"top": [], "bottom": []}

    # 물리 한 프레임
    def step(self):
        self.bx += self.vx
        self.by += self.vy

        # 좌우 벽 튕김
        if self.bx - self.BR <= 0 or self.bx + self.BR >= self.W:
            self.vx *= -1

        # 위쪽 패들 충돌 (원형)
        top_paddle = self.paddle["top"]
        dx = self.bx - top_paddle["x"]
        dy = self.by - top_paddle["y"]
        distance = (dx*dx + dy*dy)**0.5
        
        if distance <= self.PR + self.BR and self.by < top_paddle["y"] + self.PR:
            # 충돌 처리 - 패들 중심에서 공을 밀어냄
            if distance > 0:
                # 정규화된 방향 벡터
                nx = dx / distance
                ny = dy / distance
                
                # 공을 패들 밖으로 밀어냄
                self.bx = top_paddle["x"] + nx * (self.PR + self.BR)
                self.by = top_paddle["y"] + ny * (self.PR + self.BR)
                
                # 반사 벡터 계산
                dot_product = self.vx * nx + self.vy * ny
                self.vx = self.vx - 2 * dot_product * nx
                self.vy = self.vy - 2 * dot_product * ny
                
                # 스킬이 활성화되어 있으면 공 속도 증가
                if self.active_skill["top"] > 0:
                    # 활성화된 스킬의 배율 찾기
                    for skill in self.player_skills["top"]:
                        if skill["id"] == self.active_skill["top"]:
                            multiplier = skill["multiplier"]
                            self.vy *= multiplier
                            self.vx *= multiplier
                            break
                    self.active_skill["top"] = 0  # 스킬 사용 후 비활성화

        # 아래쪽 패들 충돌 (원형)
        bottom_paddle = self.paddle["bottom"]
        dx = self.bx - bottom_paddle["x"]
        dy = self.by - bottom_paddle["y"]
        distance = (dx*dx + dy*dy)**0.5
        
        if distance <= self.PR + self.BR and self.by > bottom_paddle["y"] - self.PR:
            # 충돌 처리 - 패들 중심에서 공을 밀어냄
            if distance > 0:
                # 정규화된 방향 벡터
                nx = dx / distance
                ny = dy / distance
                
                # 공을 패들 밖으로 밀어냄
                self.bx = bottom_paddle["x"] + nx * (self.PR + self.BR)
                self.by = bottom_paddle["y"] + ny * (self.PR + self.BR)
                
                # 반사 벡터 계산
                dot_product = self.vx * nx + self.vy * ny
                self.vx = self.vx - 2 * dot_product * nx
                self.vy = self.vy - 2 * dot_product * ny
                
                # 스킬이 활성화되어 있으면 공 속도 증가
                if self.active_skill["bottom"] > 0:
                    # 활성화된 스킬의 배율 찾기
                    for skill in self.player_skills["bottom"]:
                        if skill["id"] == self.active_skill["bottom"]:
                            multiplier = skill["multiplier"]
                            self.vy *= multiplier
                            self.vx *= multiplier
                            break
                    self.active_skill["bottom"] = 0  # 스킬 사용 후 비활성화

        # 골 체크 - 골대에 들어갔는지 확인
        goal_center_x = self.W // 2
        
        # 위쪽 골대 (bottom 플레이어가 득점)
        if (self.by - self.BR <= self.GOAL_HEIGHT and 
            goal_center_x - self.GOAL_WIDTH//2 <= self.bx <= goal_center_x + self.GOAL_WIDTH//2):
            self.score["bottom"] += 1
            self.reset_ball(1)  # 중앙에서 시작
        # 아래쪽 골대 (top 플레이어가 득점)
        elif (self.by + self.BR >= self.H - self.GOAL_HEIGHT and 
              goal_center_x - self.GOAL_WIDTH//2 <= self.bx <= goal_center_x + self.GOAL_WIDTH//2):
            self.score["top"] += 1
            self.reset_ball(-1)  # 중앙에서 시작
        # 상하단 벽에 닿으면 공 리셋 (골대 밖)
        elif self.by < 0 or self.by > self.H:
            self.reset_ball(1 if self.by < 0 else -1)

    def reset_ball(self, direction):
        """일반적인 공 리셋 (중앙에서 시작)"""
        self.bx, self.by = self.W//2, self.H//2
        self.vy = direction*self.SPD
        self.vx = random.choice([-self.SPD, self.SPD])

    def move_paddle(self, side, dx, dy):
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        # 패들을 원형으로 이동 (x, y축 모두 이동)
        x = max(self.PR, min(self.W-self.PR, self.paddle[side]["x"]+dx))
        y = max(self.PR, min(self.H-self.PR, self.paddle[side]["y"]+dy))
        self.paddle[side]["x"] = x
        self.paddle[side]["y"] = y

    def set_player_skills(self, side, skills):
        """플레이어의 스킬 정보 설정"""
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        self.player_skills[side] = skills

    def activate_skill(self, side, skill_id):
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        # 플레이어가 해당 스킬을 소유하고 있는지 확인
        for skill in self.player_skills[side]:
            if skill["id"] == skill_id:
                self.active_skill[side] = skill_id
                return True
        return False

    def out(self):
        # 스킬 데이터를 JSON 직렬화 가능한 형태로 변환
        def convert_skills(skills):
            converted = []
            for skill in skills:
                converted_skill = skill.copy()
                if 'multiplier' in converted_skill and hasattr(converted_skill['multiplier'], '__float__'):
                    converted_skill['multiplier'] = float(converted_skill['multiplier'])
                if 'usage_count' in converted_skill and converted_skill['usage_count'] is not None:
                    converted_skill['usage_count'] = int(converted_skill['usage_count'])
                converted.append(converted_skill)
            return converted
        
        return {
            "ball":     {"x": self.bx, "y": self.by},
            "paddles":  self.paddle,
            "scores":   self.score,
            "skills":   {
                "top": {"active": self.active_skill["top"], "available": convert_skills(self.player_skills["top"])},
                "bottom": {"active": self.active_skill["bottom"], "available": convert_skills(self.player_skills["bottom"])}
            }
        }

# ─────────── 룸 상태 관리 ───────────
games         = {}
participants  = {}
bg_lock       = Lock()

# ─────────── MySQL 유틸 ───────────
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

def save_match(g: Game):
    conn = pool.get_connection(); cur = conn.cursor()
    cur.execute("INSERT INTO matches(left_score,right_score) VALUES (%s,%s)",
                (g.score["left"], g.score["right"]))
    conn.commit(); cur.close(); conn.close()

# ─────────── Socket 이벤트 ───────────
@socketio.on("join")
def join(data):
    room = data.get("room", "default")
    username = data.get("username")
    join_room(room)
    sid = request.sid

    participants.setdefault(room, set()).add(sid)
    games.setdefault(room, Game(room))

    num = len(participants[room])          # 플레이어 인원
    side = "left" if num == 1 else "right" if num == 2 else None
    if side is None:
        emit("joined", {"side": None, "error": "방이 가득 찼습니다."})
        return

    # 유저의 스킬 정보 가져오기
    if username:
        user_skills = get_user_skills(username)
        games[room].set_player_skills(side, user_skills)

    emit("joined", {"side": side})
    emit("state", games[room].out(), room=room)
    print("JOIN", room, side, "참가자수:", num)

@socketio.on("paddle_move")
def paddle_move(data):
    g = games.get(data["room"])
    if g:
        dx = data.get("dx", 0)
        dy = data.get("dy", 0)
        g.move_paddle(data["side"], dx, dy)

@socketio.on("activate_skill")
def activate_skill(data):
    g = games.get(data["room"])
    if g:
        skill_id = data.get("skill_id", 1)
        success = g.activate_skill(data["side"], skill_id)
        if success:
            emit("skill_activated", {"side": data["side"], "skill_id": skill_id}, room=data["room"])

@socketio.on("disconnect")
def disconnect():
    sid = request.sid
    for room, sids in list(participants.items()):
        if sid in sids:
            sids.remove(sid)
            print(f"DISCONNECT: {sid} from {room}")
            if not sids:                  # 방에 아무도 없으면 삭제
                participants.pop(room, None)
                games.pop(room, None)
            break

# ─────────── 백그라운드 루프 ───────────
def loop():
    while True:
        socketio.sleep(Game.TICK)
        for r, g in games.items():
            g.step()
            socketio.emit("state", g.out(), room=r)

# ─────────── 회원가입 / 로그인 ───────────
@app.post("/api/signup")
def signup():
    data = request.get_json()
    try:
        create_user(data["username"], data["password"])
        return jsonify(ok=True)
    except mysql.connector.errors.IntegrityError:
        return jsonify(ok=False, error="USERNAME_TAKEN"), 409

@app.post("/api/login")
def login():
    data = request.get_json()
    if verify_user(data["username"], data["password"]):
        session["user"] = data["username"]
        return jsonify(ok=True)
    return jsonify(ok=False, error="INVALID_CRED"), 401

@app.get("/api/user/skills")
def get_skills():
    # 더미 유저로 자동 로그인 (세션 없이도 작동)
    username = request.args.get("username", "player1")
    
    skills = get_user_skills(username)
    return jsonify(ok=True, skills=skills)

# ─────────── 실행 ───────────
if __name__ == "__main__":
    print("server run\n")
    init_db()
    with bg_lock:
        socketio.start_background_task(loop)
    socketio.run(app, host="0.0.0.0", port=8000)    # Mac·Win 공통
