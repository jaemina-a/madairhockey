# 에어하키 게임 프로젝트

실시간 멀티플레이어 에어하키 게임으로, 데이터베이스 연동된 스킬 시스템을 제공합니다.

## 🎮 주요 기능

- **실시간 멀티플레이어**: Socket.IO 기반 실시간 게임 플레이
- **스킬 시스템**: 개인별 스킬 소유 및 사용
- **유저 관리**: 회원가입, 로그인, 개인 정보 관리
- **통계 시스템**: 게임 기록, 승률, 레벨 등
- **업적 시스템**: 다양한 업적 달성
- **마이페이지**: 유저 정보, 소유 스킬, 업적 표시

## 🛠️ 기술 스택

### 백엔드
- Python Flask
- Flask-SocketIO
- MySQL
- Werkzeug (비밀번호 암호화)

### 프론트엔드
- React 18
- Vite
- Socket.IO Client
- React Router

## 📋 설치 및 실행

### 1. 데이터베이스 설정

MySQL을 설치하고 다음 명령을 실행합니다:

```sql
CREATE DATABASE airhockey;
CREATE USER 'airhockey'@'localhost' IDENTIFIED BY 'airhockey123';
GRANT ALL PRIVILEGES ON airhockey.* TO 'airhockey'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 백엔드 설정

```bash
cd backend

# 환경변수 파일 생성
echo "DB_USER=airhockey
DB_PASSWORD=airhockey123
DB_HOST=127.0.0.1
DB_NAME=airhockey
SECRET_KEY=your-secret-key-here" > .env

# 패키지 설치
pip install -r requirements.txt

# 서버 실행
python app.py
```

### 3. 프론트엔드 설정

```bash
cd frontend

# 환경변수 파일 생성
echo "VITE_SERVER_URL=http://localhost:8000" > .env

# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

## 🎯 게임 플레이

### 조작법
- **위쪽 플레이어**: WASD 이동, 1-4 스킬 키
- **아래쪽 플레이어**: 화살표 키 이동, 1-4 스킬 키
- **스킬 사용**: 키보드 1-4 또는 스킬 버튼 클릭

### 스킬 시스템
- **스킬 1 (⚡)**: 1.5배 속도 증가
- **스킬 2 (🔥)**: 2.0배 속도 증가  
- **스킬 3 (💨)**: 2.5배 속도 증가
- **스킬 4 (🚀)**: 3.0배 속도 증가

## 더미 데이터

서버 시작 시 자동으로 생성되는 더미 유저들:
- player1, player2, player3, test_user

모든 유저는 기본적으로 다음 스킬들을 가지고 있습니다:
1. 스킬 1 (⚡): 1.5배 속도 증가
2. 스킬 2 (🔥): 2.0배 속도 증가

프론트엔드에서는 player1으로 자동 로그인됩니다.

## 🗄️ 데이터베이스 스키마

### users
- 유저 기본 정보 (ID, 유저명, 비밀번호 해시, 생성일)

### skills  
- 스킬 정보 (ID, 이름, 아이콘, 배율, 색상, 설명, 해금 조건)

### user_skills
- 유저별 스킬 소유 정보 (유저ID, 스킬ID, 해금여부, 사용횟수, 마지막사용일)

### matches
- 게임 기록 (ID, 시간, 점수)

## 🚀 향후 개발 계획

- [ ] 상점 시스템 (스킬 구매)
- [ ] 스킨 시스템 (캐릭터 커스터마이징)
- [ ] 랭킹 시스템
- [ ] 친구 시스템
- [ ] 토너먼트 모드
- [ ] 모바일 지원

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 