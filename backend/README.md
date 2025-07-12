# 에어하키 게임 백엔드

## 데이터베이스 설정

1. MySQL을 설치하고 실행합니다.

2. 데이터베이스와 사용자를 생성합니다:
```sql
CREATE DATABASE airhockey;
CREATE USER 'airhockey'@'localhost' IDENTIFIED BY 'airhockey123';
GRANT ALL PRIVILEGES ON airhockey.* TO 'airhockey'@'localhost';
FLUSH PRIVILEGES;
```

3. `.env` 파일을 생성하고 다음 내용을 추가합니다:
```
DB_USER=airhockey
DB_PASSWORD=airhockey123
DB_HOST=127.0.0.1
DB_NAME=airhockey
SECRET_KEY=your-secret-key-here
```

4. 필요한 패키지를 설치합니다:
```bash
pip install -r requirements.txt
```

5. 서버를 실행합니다:
```bash
python app.py
```

## 자동 더미 데이터 생성

서버가 시작될 때 자동으로:
- 기본 스킬 데이터를 생성합니다
- 더미 유저들을 생성합니다 (player1, player2, player3, test_user)
- 모든 유저에게 스킬 1 (⚡ 1.5x)과 스킬 2 (🔥 2.0x)를 제공합니다
- 프론트엔드에서는 player1으로 자동 로그인됩니다

## 문제 해결

만약 스킬이 표시되지 않는다면:
1. 서버를 재시작하세요
2. 마이페이지를 새로고침하세요
3. 여전히 문제가 있다면 데이터베이스를 초기화하세요:
```sql
DROP DATABASE airhockey;
CREATE DATABASE airhockey;
CREATE USER 'airhockey'@'localhost' IDENTIFIED BY 'airhockey123';
GRANT ALL PRIVILEGES ON airhockey.* TO 'airhockey'@'localhost';
FLUSH PRIVILEGES;
```

## 데이터베이스 스키마

### users 테이블
- id: 유저 고유 ID
- username: 유저명 (고유)
- pw_hash: 암호화된 비밀번호
- created: 계정 생성 시간

### skills 테이블
- id: 스킬 고유 ID
- name: 스킬 이름
- icon: 스킬 아이콘 (이모지)
- multiplier: 속도 배율
- color: 스킬 색상
- description: 스킬 설명
- unlock_condition: 해금 조건

### user_skills 테이블
- user_id: 유저 ID (users 테이블 참조)
- skill_id: 스킬 ID (skills 테이블 참조)
- unlocked: 해금 여부
- usage_count: 사용 횟수
- last_used: 마지막 사용 시간

### matches 테이블
- id: 매치 고유 ID
- ts: 매치 시간
- left_score: 왼쪽 플레이어 점수
- right_score: 오른쪽 플레이어 점수

## 기본 스킬

새로 가입한 유저는 기본적으로 다음 스킬들을 받습니다:
1. 스킬 1 (⚡): 1.5배 속도 증가
2. 스킬 2 (🔥): 2.0배 속도 증가

추가 스킬들은 상점에서 구매하거나 특정 조건을 만족하면 해금됩니다. 