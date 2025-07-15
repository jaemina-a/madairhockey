from threading import Lock
from flask_socketio import emit, join_room
from flask import request
from game_logic import Game
from database import DB
from datetime import datetime

# ─────────── 룸 상태 관리 ───────────
games         = {}
loading_games = {}
participants  = {}
bg_lock       = Lock()

def register_socket_handlers(socketio):
    @socketio.on("join_loading_ready_toggle")
    def join_loading_ready_toggle(data):
        room_name = data.get("room_name")
        side = data.get("side")
        if(side == "left"):
            loading_games[room_name].left_ready = not loading_games[room_name].left_ready
        elif(side == "right"):
            loading_games[room_name].right_ready = not loading_games[room_name].right_ready
        emit("join_loading_ready_toggle_success", {"room_name": room_name, "side": side, "ready": loading_games[room_name].left_ready if side == "left" else loading_games[room_name].right_ready}, to=room_name)
    @socketio.on("join_loading")
    def join_loading(data):
        room_name = data.get("room_name")
        username = data.get("username")
        sid = request.sid
        if(loading_games[room_name].COUNT == 0):
            left_username = username
            loading_games[room_name].left_username = username
            right_username = "waiting"
            left_user_skills = DB.get_user_skills(username)
            loading_games[room_name].left_user_skills = left_user_skills
            right_user_skills = []
            loading_games[room_name].right_ready = False
            loading_games[room_name].left_ready = False
            loading_games[room_name].COUNT += 1
            DB.update_current_player(room_name, loading_games[room_name].COUNT)
        elif(loading_games[room_name].COUNT == 1):
            left_username = loading_games[room_name].left_username
            right_username = username
            loading_games[room_name].right_username = username
            left_user_skills = loading_games[room_name].left_user_skills
            right_user_skills = DB.get_user_skills(username)
            loading_games[room_name].right_user_skills = right_user_skills
            loading_games[room_name].COUNT += 1
            DB.update_current_player(room_name, loading_games[room_name].COUNT)
        else:
            print("join_loading_failed in server", room_name, username)
            emit("join_loading_fail", {"error": "방에 이미 2명이 있습니다."}, to=sid)
            return
        # 준비 상태 초기화  
        
            
        #2명이 모두 차면 이제 상태를 바꿔줘야함.
        if loading_games[room_name].COUNT == 2:
            DB.toggle_is_playing(room_name)
            print("room_updated in server, emit room_updated")

        a = DB.get_room_list()
        a_serialized = [serialize_room(room) for room in a]
        socketio.emit("room_updated", a_serialized)
        side = "left" if loading_games[room_name].COUNT == 1 else "right"
        print("join_loading_success in server", room_name, username, side)
        join_room(room_name)
        emit_data = {
            "room_name": room_name,
            "left_username": left_username,
            "right_username": right_username,
            "side": side,
            "left_user_skills": left_user_skills,
            "right_user_skills" :right_user_skills,
            "left_ready" : loading_games[room_name].left_ready,
            "right_ready" : loading_games[room_name].right_ready
            }
        emit("join_loading_success", emit_data, to = room_name)

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
            user_skills = DB.get_user_skills(username)
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
    
    # 로딩 방을 만드는 것임
    @socketio.on("room_create")
    def room_create(data):
        room_name = data.get("room_name")
        username = data.get("username")
        sid = request.sid
        # 방 이름 중복 체크
        print("room_create in server", room_name, username)
        room_list = DB.get_room_list()
        if any(room["room_name"] == room_name for room in room_list):
            emit("room_create_failed", {"error": "이미 존재하는 방 이름입니다."}, to=sid)
            return
        DB.make_room(username, room_name)
        loading_games[room_name] = type('LoadingGame', (), {})()
        loading_games[room_name].COUNT = 0
        print("loading_games[room_name]",loading_games[room_name].COUNT)
        a = DB.get_room_list()
        a_serialized = [serialize_room(room) for room in a]
        socketio.emit("room_updated", a_serialized)

def get_games():
    return games
def serialize_room(room):
    room = room.copy()  # 원본 변형 방지
    if isinstance(room.get('created_at'), datetime):
        room['created_at'] = room['created_at'].isoformat()
    return room

def get_participants():
    return participants

def get_bg_lock():
    return bg_lock 