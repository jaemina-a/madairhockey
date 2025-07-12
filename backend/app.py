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
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")   # 세션 서명에 사용
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# ─────────── 게임 로직 ───────────
class Game:
    W, H = 400, 700
    PR = 15     # 패들 반지름 (원형)g
    BR = 12     # 공 반지름
    SPD, TICK = 7, 1/60         # 픽셀/frame, 60 fps
    
    # 골대 설정
    GOAL_WIDTH = 121  # 골대 폭
    GOAL_HEIGHT = 20  # 골대 높이
    
    # 스킬 배율 정의
    SKILL_MULTIPLIERS = {
        1: 1.5,  # 스킬 1: 1.5배
        2: 2.0,  # 스킬 2: 2.0배
        3: 2.5,  # 스킬 3: 2.5배
        4: 3.0   # 스킬 4: 3.0배
    }

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
                    multiplier = self.SKILL_MULTIPLIERS[self.active_skill["top"]]
                    self.vy *= multiplier
                    self.vx *= multiplier
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
                    multiplier = self.SKILL_MULTIPLIERS[self.active_skill["bottom"]]
                    self.vy *= multiplier
                    self.vx *= multiplier
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

    def activate_skill(self, side, skill_number):
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        # 스킬 번호가 유효한지 확인
        if skill_number in self.SKILL_MULTIPLIERS:
            self.active_skill[side] = skill_number
            return True
        return False

    def out(self):
        return {
            "ball":     {"x": self.bx, "y": self.by},
            "paddles":  self.paddle,
            "scores":   self.score,
            "skills":   {
                "top": {"active": self.active_skill["top"]},
                "bottom": {"active": self.active_skill["bottom"]}
            }
        }

# ─────────── 룸 상태 관리 ───────────
games         = {}
participants  = {}
bg_lock       = Lock()

# ─────────── Socket 이벤트 ───────────
@socketio.on("join")
def join(data):
    room = data.get("room", "default")
    join_room(room)
    sid = request.sid

    participants.setdefault(room, set()).add(sid)
    games.setdefault(room, Game(room))

    num = len(participants[room])          # 플레이어 인원
    side = "left" if num == 1 else "right" if num == 2 else None
    if side is None:
        emit("joined", {"side": None, "error": "방이 가득 찼습니다."})
        return

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
        skill_number = data.get("skill_number", 1)
        success = g.activate_skill(data["side"], skill_number)
        if success:
            emit("skill_activated", {"side": data["side"], "skill_number": skill_number}, room=data["room"])

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

# ─────────── MySQL 유틸 ───────────
def init_db():
    conn = pool.get_connection(); cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS matches(
            id INT AUTO_INCREMENT PRIMARY KEY,
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            left_score INT,
            right_score INT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(32) UNIQUE,
            pw_hash VARCHAR(255),
            created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit(); cur.close(); conn.close()

def save_match(g: Game):
    conn = pool.get_connection(); cur = conn.cursor()
    cur.execute("INSERT INTO matches(left_score,right_score) VALUES (%s,%s)",
                (g.score["left"], g.score["right"]))
    conn.commit(); cur.close(); conn.close()

# ─────────── 회원가입 / 로그인 ───────────
def create_user(username, password):
    pw_hash = generate_password_hash(password)
    conn = pool.get_connection(); cur = conn.cursor()
    cur.execute("INSERT INTO users(username, pw_hash) VALUES (%s,%s)", (username, pw_hash))
    conn.commit(); cur.close(); conn.close()

def verify_user(username, password):
    conn = pool.get_connection(); cur = conn.cursor(dictionary=True)
    cur.execute("SELECT pw_hash FROM users WHERE username=%s", (username,))
    row = cur.fetchone()
    cur.close(); conn.close()
    return row and check_password_hash(row["pw_hash"], password)

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

# ─────────── 실행 ───────────
if __name__ == "__main__":
    print("server run\n")
    init_db()
    with bg_lock:
        socketio.start_background_task(loop)
    socketio.run(app, host="0.0.0.0", port=8000)    # Mac·Win 공통
