import random
import time
import math

class Game:
    W, H = 400, 700
    PR = 25     # 패들 반지름 (원형)
    BR = 12     # 공 반지름
    SPD, TICK = 5, 1/80     # 픽셀/frame, 60 fps
    
    # 골대 설정
    GOAL_WIDTH = 121  # 골대 폭
    GOAL_HEIGHT = 20  # 골대 높이
    GOAL_WIDTH_MIN = 60    # 최소 골대 폭(절대값)
    GOAL_WIDTH_SKILL3 = 0.25 # 스킬3: 1/2
    GOAL_WIDTH_SKILL4 = 0.125 # 스킬4: 1/4
    GOAL_WIDTH_DURATION3 = 5.0 # 스킬3: 5초
    GOAL_WIDTH_DURATION4 = 3.0 # 스킬4: 3초

    def __init__(self, room, socketio=None):
        self.room = room
        self.socketio = socketio
        self.bx, self.by = self.W//2, self.H//2
        self.vx, self.vy = self.SPD, self.SPD
        self.paddle = {
            "top": {"x": self.W//2, "y": 50},
            "bottom": {"x": self.W//2, "y": self.H-50}
        }
        self.score = {"top": 0, "bottom": 0}
        self.active_skill = {"top": 0, "bottom": 0}  # 현재 활성화된 스킬 ID
        self.selected_skill = {"top": 0, "bottom": 0}  # 선택된 스킬 ID
        self.player_skills = {"top": [], "bottom": []}
        self.skill_cooldowns = {"top": {}, "bottom": {}}  # 스킬별 마지막 사용 시간
        self.base_speed = self.SPD
        self.base_goal_width = self.GOAL_WIDTH
        self.goal_width_effect = {"top": None, "bottom": None} # 각 side별로 관리

    def emit(self, event, data):
        """소켓 이벤트를 emit하는 헬퍼 메서드"""
        if self.socketio:
            self.socketio.emit(event, data, room=self.room)

    # 물리 한 프레임
    def step(self):
        self.bx += self.vx
        self.by += self.vy

        # 골대 스킬 효과 적용 (side별)
        now = time.time()
        for side in ["top", "bottom"]:
            eff = self.goal_width_effect[side]
            if eff and now > eff["until"]:
                self.goal_width_effect[side] = None
        # 득점 체크용: 각 골대별로 적용
        goal_width_top = int(self.W * (self.goal_width_effect["top"]["ratio"] if self.goal_width_effect["top"] else 0.5))
        goal_width_top = max(goal_width_top, self.GOAL_WIDTH_MIN)
        goal_left_top = (self.W - goal_width_top) // 2
        goal_right_top = (self.W + goal_width_top) // 2
        goal_width_bottom = int(self.W * (self.goal_width_effect["bottom"]["ratio"] if self.goal_width_effect["bottom"] else 0.5))
        goal_width_bottom = max(goal_width_bottom, self.GOAL_WIDTH_MIN)
        goal_left_bottom = (self.W - goal_width_bottom) // 2
        goal_right_bottom = (self.W + goal_width_bottom) // 2

        # 공이 골대 영역(y) 안에 있는지
        in_top_goal_area = self.by - self.BR <= self.GOAL_HEIGHT
        in_bottom_goal_area = self.by + self.BR >= self.H - self.GOAL_HEIGHT

        # 좌우 벽 튕김 (골대 영역(y)에서는 튕기지 않음)
        if not (in_top_goal_area or in_bottom_goal_area):
            if self.bx - self.BR <= 0:
                self.bx = self.BR
                self.vx *= -1
            elif self.bx + self.BR >= self.W:
                self.bx = self.W - self.BR
                self.vx *= -1

        # 위쪽 패들 충돌 (원형)
        top_paddle = self.paddle["top"]
        dx = self.bx - top_paddle["x"]
        dy = self.by - top_paddle["y"]
        distance = (dx*dx + dy*dy)**0.5
        
        # 충돌 감지 개선: 거리만으로 판단하고 추가 조건 제거
        if distance <= self.PR + self.BR:
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
                
                self.emit("bounce", {"side": "top"})
                print("bounce emit in game_logic top")
                # 선택된 스킬이 있으면 자동으로 활성화
                if self.active_skill["top"] == 0:  # 이미 활성화된 스킬이 없을 때만
                    activated = self.auto_activate_selected_skill("top")
                
                # 스킬이 활성화되어 있으면 공 속도 증가 및 쿨타임 시작
                if self.active_skill["top"] > 0:
                    # 활성화된 스킬의 배율 찾기
                    for skill in self.player_skills["top"]:
                        if skill["id"] == self.active_skill["top"]:
                            multiplier = skill["multiplier"]
                            self.vy *= multiplier
                            self.vx *= multiplier
                            break
                    self.emit("skill_activated", {"side": "top", "skill_id": self.active_skill["top"]})
                    self.apply_skill_effect("top")

        # 아래쪽 패들 충돌 (원형)
        bottom_paddle = self.paddle["bottom"]
        dx = self.bx - bottom_paddle["x"]
        dy = self.by - bottom_paddle["y"]
        distance = (dx*dx + dy*dy)**0.5
        
        # 충돌 감지 개선: 거리만으로 판단하고 추가 조건 제거
        if distance <= self.PR + self.BR:
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

                self.emit("bounce", {"side": "bottom"})
                print("bounce emit in game_logic bottom")

                # 선택된 스킬이 있으면 자동으로 활성화
                if self.active_skill["bottom"] == 0:  # 이미 활성화된 스킬이 없을 때만
                    activated = self.auto_activate_selected_skill("bottom")
                
                # 스킬이 활성화되어 있으면 공 속도 증가 및 쿨타임 시작
                if self.active_skill["bottom"] > 0:
                    # 활성화된 스킬의 배율 찾기
                    for skill in self.player_skills["bottom"]:
                        if skill["id"] == self.active_skill["bottom"]:
                            multiplier = skill["multiplier"]
                            self.vy *= multiplier
                            self.vx *= multiplier
                            break

                    self.emit("skill_activated", {"side": "bottom", "skill_id": self.active_skill["bottom"]})
                    self.apply_skill_effect("bottom")


        # 골 체크 - 골대에 들어갔는지 확인
        goal_width = self.W // 2  # 골대 폭을 전체의 1/2로 설정
        goal_left = (self.W - goal_width) // 2
        goal_right = (self.W + goal_width) // 2

        # 위쪽 골대 (bottom 플레이어가 득점)
        if (self.by <= self.GOAL_HEIGHT - self.BR/2 and goal_left_top <= self.bx <= goal_right_top):
            self.score["bottom"] += 1
            self.reset_ball(1)  # 중앙에서 시작
        # 아래쪽 골대 (top 플레이어가 득점)
        elif (self.by >= self.H - self.GOAL_HEIGHT + self.BR/2 and goal_left_bottom <= self.bx <= goal_right_bottom):
            self.score["top"] += 1
            self.reset_ball(-1)  # 중앙에서 시작
        # 상단 벽 튕김 (골대 범위 밖)
        elif self.by - self.BR <= 0 and not (goal_left_top <= self.bx <= goal_right_top and self.by - self.BR <= self.GOAL_HEIGHT):
            self.by = self.BR
            self.vy *= -1
        # 하단 벽 튕김 (골대 범위 밖)
        elif self.by + self.BR >= self.H and not (goal_left_bottom <= self.bx <= goal_right_bottom and self.by + self.BR >= self.H - self.GOAL_HEIGHT):
            self.by = self.H - self.BR
            self.vy *= -1
        self.socketio.emit("state", self.out(), room=self.room)

    def reset_ball(self, direction):
        """골이 들어간 후 중앙에서 1초 대기 후 발사"""
        self.bx, self.by = self.W // 2, self.H // 2
        self.vx, self.vy = 0, 0  # 정지 상태

        if self.socketio:
            # 상태를 즉시 전송 (공은 정지한 채 중앙에 있음)
            self.emit("state", self.out())

            # 1초 후에 방향 설정 및 상태 전송
            def resume_ball():
                time.sleep(1.0)  # 1초 대기

                angle = random.uniform(-0.4, 0.4)  # 살짝 좌우 편차
                base_angle = -1 if direction < 0 else 1  # 위 또는 아래
                speed = self.SPD
                self.vx = speed * math.sin(angle)
                self.vy = speed * base_angle * math.cos(angle)

                # 방향 설정 이후 상태 다시 전송
                self.emit("state", self.out())

            self.socketio.start_background_task(resume_ball)



    def move_paddle(self, side, dx, dy):
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        # 패들을 원형으로 이동 (x, y축 모두 이동)
        x = max(self.PR, min(self.W-self.PR, self.paddle[side]["x"]+dx))
        y = max(self.PR, min(self.H-self.PR, self.paddle[side]["y"]+dy))
        self.paddle[side]["x"] = x
        self.paddle[side]["y"] = y

    def set_paddle_position(self, side, x, y):
        """패들을 절대 위치로 이동 (마우스 조작용)"""
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        # 패들을 원형으로 이동 (x, y축 모두 이동)
        x = max(self.PR, min(self.W-self.PR, x))
        y = max(self.PR, min(self.H-self.PR, y))
        self.paddle[side]["x"] = x
        self.paddle[side]["y"] = y

    def set_player_skills(self, side, skills):
        """플레이어의 스킬 정보 설정"""
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        self.player_skills[side] = skills

    def set_selected_skill(self, side, skill_id):
        """플레이어가 선택한 스킬 설정"""
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        self.selected_skill[side] = skill_id

    def activate_skill(self, side, skill_id):
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        # 플레이어가 해당 스킬을 소유하고 있는지 확인
        for skill in self.player_skills[side]:
            if skill["id"] == skill_id:
                # 쿨타임 확인 - 스킬이 이미 활성화되어 있으면 사용 불가
                if self.active_skill[side] > 0:
                    return False
                
                # 스킬 활성화 (쿨타임은 실제 사용 시점에 기록)
                self.active_skill[side] = skill_id
                
                # 3,4번 스킬은 즉시 효과 적용
                if skill_id in [3, 4]:
                    self.apply_skill_effect(side)
                
                return True
        return False

    def auto_activate_selected_skill(self, side):
        """충돌 시 선택된 스킬을 자동으로 활성화"""
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        selected_id = self.selected_skill[side]
        if selected_id > 0:
            # 스킬 활성화
            self.active_skill[side] = selected_id
            # 선택된 스킬 리셋 (선택 상태 취소)
            self.selected_skill[side] = 0
            return True
        return False

    def apply_skill_effect(self, side):
        """스킬 효과를 적용"""
        if self.active_skill[side] > 0:
            skill_id = self.active_skill[side]
            # 골대 축소 스킬(3,4)
            if skill_id == 3:
                self.goal_width_effect[side] = {"ratio": self.GOAL_WIDTH_SKILL3, "until": time.time() + self.GOAL_WIDTH_DURATION3}
            elif skill_id == 4:
                self.goal_width_effect[side] = {"ratio": self.GOAL_WIDTH_SKILL4, "until": time.time() + self.GOAL_WIDTH_DURATION4}
            self.emit("state", self.out())
            self.active_skill[side] = 0


    def get_skill_cooldown(self, side, skill_id):
        """스킬의 남은 쿨타임을 반환 (초 단위)"""
        if side == "left": side = "top"
        if side == "right": side = "bottom"
        
        if skill_id not in self.skill_cooldowns[side]:
            return 0.0
        
        current_time = time.time()
        last_used = self.skill_cooldowns[side][skill_id]
        
        # 데이터베이스에서 쿨타임 정보 가져오기
        cooldown_duration = 3.0  # 기본값
        for skill in self.player_skills[side]:
            if skill["id"] == skill_id and "cooldown" in skill:
                cooldown_duration = skill["cooldown"]
                break
        
        remaining = cooldown_duration - (current_time - last_used)
        return max(0.0, remaining)

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
        
        # 골대 효과 디버그 로그
        top_ratio = self.goal_width_effect["top"]["ratio"] if self.goal_width_effect["top"] else 0.5
        bottom_ratio = self.goal_width_effect["bottom"]["ratio"] if self.goal_width_effect["bottom"] else 0.5
        
        if top_ratio != 0.5 or bottom_ratio != 0.5:
            print(f"골대 효과 적용: top={top_ratio}, bottom={bottom_ratio}")
        
        return {
            "ball":     {"x": self.bx, "y": self.by, "timestamp": time.time() * 1000},
            "paddles":  self.paddle,
            "scores":   self.score,
            "goal_width_ratio": {
                "top": top_ratio,
                "bottom": bottom_ratio
            },
            "skills":   {
                "top": {
                    "active": self.active_skill["top"], 
                    "available": convert_skills(self.player_skills["top"])
                },
                "bottom": {
                    "active": self.active_skill["bottom"], 
                    "available": convert_skills(self.player_skills["bottom"])
                }
            }
        } 