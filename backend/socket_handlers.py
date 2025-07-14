from threading import Lock
from flask_socketio import emit, join_room
from flask import request
from game_logic import Game
from database import get_user_skills

# ─────────── 룸 상태 관리 ───────────
games         = {}
participants  = {}
bg_lock       = Lock()

def register_socket_handlers(socketio):
    @socketio.on("join")
    def join(data):
        room = data.get("room", "default")
        username = data.get("username")
        print("join emit in server", room, username)
        join_room(room)
        sid = request.sid

        participants.setdefault(room, set()).add(sid)
        games.setdefault(room, Game(room, socketio))

        num = len(participants[room])  # 현재 인원 수
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

        # 2명이 모이면 game_ready 이벤트 emit
        if num == 2:
            socketio.emit("game_ready", {}, room=room)

    @socketio.on("paddle_move")
    def paddle_move(data):
        g = games.get(data["room"])
        if g:
            dx = data.get("dx", 0)
            dy = data.get("dy", 0)
            g.move_paddle(data["side"], dx, dy)

    @socketio.on("paddle_position")
    def paddle_position(data):
        g = games.get(data["room"])
        if g:
            x = data.get("x", 0)
            y = data.get("y", 0)
            g.set_paddle_position(data["side"], x, y)

    @socketio.on("activate_skill")
    def activate_skill(data):
        g = games.get(data["room"])
        if g:
            skill_id = data.get("skill_id", 1)
            success = g.activate_skill(data["side"], skill_id)
            if success:
                emit("skill_activated", {"side": data["side"], "skill_id": skill_id}, room=data["room"])

    @socketio.on("set_selected_skill")
    def set_selected_skill(data):
        g = games.get(data["room"])
        if g:
            skill_id = data.get("skill_id", 0)
            g.set_selected_skill(data["side"], skill_id)

    @socketio.on("disconnect")
    def disconnect():
        sid = request.sid
        for room, sids in list(participants.items()):
            if sid in sids:
                sids.remove(sid)
                print(f"DISCONNECT: {sid} from {room}")
                if not sids:  # 방에 아무도 없으면 삭제
                    participants.pop(room, None)
                    games.pop(room, None)
                else:
                    # 남아있는 플레이어에게 알림
                    socketio.emit("opponent_disconnected", {}, room=room)
                break

def get_games():
    return games

def get_participants():
    return participants

def get_bg_lock():
    return bg_lock 