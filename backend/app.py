import os, random
from threading import Lock

from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room
import mysql.connector

# ─────────── DB 설정 ───────────
DB_CONF = dict(
    user     = os.getenv("DB_USER", "root"),
    password = os.getenv("DB_PASSWORD", "1024"),
    host     = os.getenv("DB_HOST", "127.0.0.1"),
    database = os.getenv("DB_NAME", "airhockey"),
    use_pure=True
)
pool = mysql.connector.pooling.MySQLConnectionPool(pool_name="ah_pool", pool_size=5, **DB_CONF)

# ─────────── Flask + Socket.IO ───────────
app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "secret!")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")   # eventlet 사용

# ─────────── 게임 로직 ───────────
class Game:
    W, H = 400, 700
    PW, PH, BR = 80, 10, 12     # 패들 폭/높이, 공 반지름
    SPD, TICK = 7, 1/60         # 픽셀/frame, 60 fps

    def __init__(self, room):
        self.room = room
        self.reset_ball(random.choice([-1, 1]))
        mid = self.W//2 - self.PW//2
        self.paddle = {"top": mid, "bottom": mid}
        self.score  = {"top": 0, "bottom": 0}

    # ───────── 상태 업데이트 ─────────
    def step(self):
        self.bx += self.vx
        self.by += self.vy

        # 좌우 벽 튕김
        if self.bx - self.BR <= 0 or self.bx + self.BR >= self.W:
            self.vx *= -1

        # 위쪽 패들 충돌
        if self.by - self.BR <= self.PH and self.paddle["top"] <= self.bx <= self.paddle["top"]+self.PW:
            self.vy, self.by = abs(self.vy), self.PH + self.BR
        # 아래쪽 패들 충돌
        if self.by + self.BR >= self.H-self.PH and self.paddle["bottom"] <= self.bx <= self.paddle["bottom"]+self.PW:
            self.vy, self.by = -abs(self.vy), self.H-self.PH-self.BR

        # 골 체크
        if self.by < 0:
            self.score["bottom"] += 1
            self.reset_ball(1)
        elif self.by > self.H:
            self.score["top"] += 1
            self.reset_ball(-1)

    def reset_ball(self, direction):
        self.bx, self.by = self.W//2, self.H//2
        self.vy = direction*self.SPD
        self.vx = random.choice([-self.SPD, self.SPD])

    def move_paddle(self, side, dx):
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        x = max(0, min(self.W-self.PW, self.paddle[side]+dx))
        self.paddle[side] = x

    def out(self):
        return {
            "ball": {"x": self.bx, "y": self.by},
            "paddles": self.paddle,
            "scores": self.score
        }

# 룸별 상태
games = {}
bg_lock = Lock()
participants = {}

# ───────── Socket 이벤트 ─────────
@socketio.on("join")
def join(data):
    room = data.get("room", "default")
    join_room(room)
    sid = request.sid
    if room not in participants:
        participants[room] = set()
    participants[room].add(sid)
    if room not in games:
        games[room] = Game(room)
    # 참가자 수에 따라 side 할당
    num = len(participants[room])
    if num == 1:
        side = "left"
    elif num == 2:
        side = "right"
    else:
        emit("joined", {"side": None, "error": "방이 가득 찼습니다."})
        return
    emit("joined", {"side": side})
    emit("state", games[room].out(), room=room)
    print("JOIN", room, side, "참가자수:", num)

@socketio.on("paddle_move")
def paddle_move(data):
    g = games.get(data["room"])
    if g:
        g.move_paddle(data["side"], data["dx"])

@socketio.on("disconnect")
def disconnect():
    sid = request.sid
    for room, sids in list(participants.items()):
        if sid in sids:
            sids.remove(sid)
            print(f"DISCONNECT: {sid} from {room}")
            # 방에 아무도 없으면 participants와 games에서 room 삭제
            if not sids:
                del participants[room]
                if room in games:
                    del games[room]
            break

# ───────── 백그라운드 루프 ─────────
def loop():
    while True:
        socketio.sleep(Game.TICK)
        for r, g in games.items():
            g.step()
            socketio.emit("state", g.out(), room=r)

# ───────── MySQL: 매치 기록 ─────────
def init_db():
    conn = pool.get_connection(); cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS matches(
            id INT AUTO_INCREMENT PRIMARY KEY,
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            left_score INT, right_score INT
        )""")
    conn.commit(); cur.close(); conn.close()

def save_match(g: Game):
    conn = pool.get_connection(); cur = conn.cursor()
    cur.execute("INSERT INTO matches(left_score,right_score) VALUES(%s,%s)",
                (g.score["left"], g.score["right"]))
    conn.commit(); cur.close(); conn.close()

# ───────── 실행 ─────────
if __name__ == "__main__":
    print("sever run!\n")
    init_db()
    with bg_lock:
        socketio.start_background_task(loop)
    socketio.run(app, host="0.0.0.0", port=8000)   # Mac·Win 공통
