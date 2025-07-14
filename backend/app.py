# backend/app.py
import os
from dotenv import load_dotenv
load_dotenv()                         # .env 파일 읽기

from flask import Flask, request, jsonify, session
from flask_socketio import SocketIO
import mysql.connector

# 분리된 모듈들 import
from game_logic import Game
from database import DB
from socket_handlers import register_socket_handlers, get_games, get_bg_lock

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

# Socket.IO 핸들러 등록
register_socket_handlers(socketio)

# ─────────── 백그라운드 루프 ───────────
def loop():
    games = get_games()
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
        DB.create_user(data["username"], data["password"])
        return jsonify(ok=True)
    except mysql.connector.errors.IntegrityError:
        return jsonify(ok=False, error="USERNAME_TAKEN"), 409

@app.post("/api/login")
def login():
    data = request.get_json()
    if DB.verify_user(data["username"], data["password"]):
        session["user"] = data["username"]
        return jsonify(ok=True)
    return jsonify(ok=False, error="INVALID_CRED"), 401

@app.get("/api/user/skills")
def get_skills():
    # 더미 유저로 자동 로그인 (세션 없이도 작동)
    username = request.args.get("username", "player1")
    
    skills = DB.get_user_skills(username)
    return jsonify(ok=True, skills=skills)

# ─────────── 실행 ───────────
if __name__ == "__main__":
    print("server run\n")
    # DB 초기화가 필요할 때만 아래 줄을 수동으로 실행하세요
    # DB.init_db()
    bg_lock = get_bg_lock()
    with bg_lock:
        socketio.start_background_task(loop)
    socketio.run(app, host="0.0.0.0", port=8000)    # Mac·Win 공통
