# 에어하키 게임 프론트엔드

## 설정 방법

1. 필요한 패키지를 설치합니다:
```bash
npm install
```

2. `.env` 파일을 생성하고 다음 내용을 추가합니다:
```
VITE_SERVER_URL=http://localhost:8000
```

3. 개발 서버를 실행합니다:
```bash
npm run dev
```

## 주요 기능

- **로그인/회원가입**: 유저 계정 관리
- **게임 플레이**: 실시간 멀티플레이어 에어하키
- **스킬 시스템**: DB 연동된 개인 스킬 관리
- **마이페이지**: 유저 통계, 업적, 소유 스킬 표시
- **상점**: 스킬 구매 (추후 구현 예정)
- **스킨**: 캐릭터 커스터마이징 (추후 구현 예정)

## 기술 스택

- React 18
- Vite
- Socket.IO Client
- React Router
- CSS-in-JS (인라인 스타일)

## 게임 조작법

- **위쪽 플레이어**: WASD 이동, 1-4 스킬 키
- **아래쪽 플레이어**: 화살표 키 이동, 1-4 스킬 키
- **스킬 사용**: 키보드 1-4 또는 스킬 버튼 클릭
