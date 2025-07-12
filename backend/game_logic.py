import random

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