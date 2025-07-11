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
    W, H = 800, 400
    PW, PH, BR = 10, 80, 10     # paddle width/height, ball radius
    SPD, TICK = 5, 1/60         # px per frame, 60 fps

    def __init__(self, room):
        self.room = room
        self.reset_ball(random.choice([-1, 1]))
        mid = self.H // 2 - self.PH // 2
        self.paddle = {"left": mid, "right": mid}
        self.score  = {"left": 0,    "right": 0}

    # 물리 한 프레임
    def step(self):
        self.bx += self.vx
        self.by += self.vy

        # 위·아래 벽
        if self.by - self.BR <= 0 or self.by + self.BR >= self.H:
            self.vy *= -1

        # 왼쪽 패들
        if (self.bx - self.BR <= self.PW
                and self.paddle["left"] <= self.by <= self.paddle["left"] + self.PH):
            self.vx, self.bx =  abs(self.vx), self.PW + self.BR
        # 오른쪽 패들
        if (self.bx + self.BR >= self.W - self.PW
                and self.paddle["right"] <= self.by <= self.paddle["right"] + self.PH):
            self.vx, self.bx = -abs(self.vx), self.W - self.PW - self.BR

        # 골
        if self.bx < 0:
            self.score["right"] += 1
            self.reset_ball(1)
        elif self.bx > self.W:
            self.score["left"]  += 1
            self.reset_ball(-1)

    def reset_ball(self, direction):
        self.bx, self.by = self.W // 2, self.H // 2
        self.vx = direction * self.SPD
        self.vy = random.choice([-self.SPD, self.SPD])

    def move_paddle(self, side, dy):
        y = max(0, min(self.H - self.PH, self.paddle[side] + dy))
        self.paddle[side] = y

    def out(self):
        return {
            "ball":     {"x": self.bx, "y": self.by},
            "paddles":  self.paddle,
            "scores":   self.score
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
        g.move_paddle(data["side"], data["dy"])

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
            pw_hash VARCHAR(128),
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
    print("server run!\n")
    init_db()
    with bg_lock:
        socketio.start_background_task(loop)
    socketio.run(app, host="0.0.0.0", port=8000)    # Mac·Win 공통
