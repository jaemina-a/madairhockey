import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import fry_audio from "../assets/audio/audio_fry.mp3";

// 세로형 에어하키 보드 크기
const W = 406, H = 700, PR = 25, BR = 12;

// 골대 설정
const GOAL_WIDTH = 120;
const GOAL_HEIGHT = 20;

const audio_fry = new Audio(fry_audio);

// Throttle 함수
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

export default function GameBoard() {
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1';
  
  const [state, setState] = useState(null);
  const [side, setSide] = useState(null);
  const [userSkills, setUserSkills] = useState([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [localPaddlePosition, setLocalPaddlePosition] = useState(null);  // 내 패들 위치 (즉시 반영용)
  const [serverPaddlePosition, setServerPaddlePosition] = useState(null);  // 서버에서 온 패들 위치
  const [selectedSkillId, setSelectedSkillId] = useState(null);
  const [gameReady, setGameReady] = useState(false);
  const [status, setStatus] = useState('connecting'); // connecting | waiting | ready | disconnected
  const sideRef = useRef(null);
  const room = "default";
  const socketRef = useRef(null);
  const gameBoardRef = useRef(null);
  const lastServerUpdate = useRef(0);
  const [localBallPosition, setLocalBallPosition] = useState(null);
  const [serverBallPosition, setServerBallPosition] = useState(null);

  // 유저 스킬 가져오기
  useEffect(() => {
    const fetchUserSkills = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/user/skills?username=${encodeURIComponent(username)}`);
        const data = await response.json();
        if (data.ok) {
          setUserSkills(data.skills);
          console.log('유저 스킬:', data.skills);
        }
      } catch (error) {
        console.error('스킬 가져오기 실패:', error);
      }
    };
    
    fetchUserSkills();
  }, [username]);

  // 소켓 연결 - 컴포넌트 마운트 시 한 번만 실행
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL, { transports: ['websocket'] });socketRef.current = socket;

    // 서버에 접속
    socket.emit("join", { room, username });

    // joined 이벤트
    socket.on("joined", data => {
      setSide(data.side);
      sideRef.current = data.side;
      setStatus('waiting');

      // �� 핵심: 게임 시작할 때 로컬 위치 초기화
      setLocalPaddlePosition(null);
      setServerPaddlePosition(null);
    });

    // 게임 상태 업데이트
    socket.on("state", data => {
      setState(data);

      // 클라이언트 패들 위치 동기화
      // if (sideRef.current && data.paddles) {
      //   const currentPaddle = sideRef.current === 'left' ? data.paddles.top : data.paddles.bottom;
      //   setLocalPaddlePosition(currentPaddle);
      // }
      //핵심: 서버에서 온 패들 위치를 별도로 저장
      if (side && data.paddles) {
        const serverPos = side === 'left' ? data.paddles.top : data.paddles.bottom;
        setServerPaddlePosition(serverPos);
      }

      // 스킬 상태 동기화
      if (sideRef.current && data.skills) {
        const mySkillData = sideRef.current === 'left' ? data.skills.top : data.skills.bottom;
        if (mySkillData.active > 0 && selectedSkillId === mySkillData.active) {
          setSelectedSkillId(null);
        }
      }
      // 🔥 공 위치 보간용: 서버에서 온 공 위치 별도 저장
      if (data.ball) {
        setServerBallPosition(data.ball);
      }
    });
    
    console.log("skill_activated socket.on success");
    // 스킬 활성화 피드백
    socket.on("skill_activated", () => {
      console.log("skill_activated emit success");
      setSelectedSkillId(null);
    });

    socket.on("bounce", () => {
      console.log("bounce emit success");
      audio_fry.play();
    });

    // 두 명 매칭 완료
    socket.on("game_ready", () => {
      setGameReady(true);
      console.log("game_ready on success");
      setStatus('ready');
    });

    // 상대방 이탈
    socket.on("opponent_disconnected", () => {
      alert("상대방이 나갔습니다. 게임이 종료됩니다.");
      setStatus('disconnected');
      window.location.href = "/";
    });

    return () => {
      socket.disconnect();
    };
  }, [username, room]);

  // 서버 업데이트 throttle 함수
  const throttledServerUpdate = useCallback(
    throttle((x, y) => {
      if (socketRef.current) {
        socketRef.current.emit("paddle_position", { room, side, x, y });
      }
    }, 16), // 약 60fps
    [room, side]
  );

  // 마우스 이벤트 처리
  useEffect(() => {
    if (!gameReady) return; // 게임 준비 전에는 리스너 등록 X

    const handleMouseMove = (e) => {
      if (!gameBoardRef.current || !side) return;
      
      const rect = gameBoardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // 게임 보드 내부 좌표로 변환
      const gameX = Math.max(PR, Math.min(W - PR, x));
      const gameY = Math.max(PR, Math.min(H - PR, y));
      
      //setMousePosition({ x: gameX, y: gameY });
      
      // 로컬 상태 즉시 업데이트 (즉시 반응)
      setLocalPaddlePosition({ x: gameX, y: gameY });
      
      // 서버에 위치 전송 (throttle 적용)
      throttledServerUpdate(gameX, gameY);
    };

    const handleMouseEnter = () => {
      // 마우스가 게임 보드에 들어왔을 때 처리
    };

    const handleMouseLeave = () => {
      // 마우스가 게임 보드를 벗어났을 때 처리
    };

    const gameBoard = gameBoardRef.current;
    if (gameBoard) {
      gameBoard.addEventListener('mousemove', handleMouseMove);
      gameBoard.addEventListener('mouseenter', handleMouseEnter);
      gameBoard.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        gameBoard.removeEventListener('mousemove', handleMouseMove);
        gameBoard.removeEventListener('mouseenter', handleMouseEnter);
        gameBoard.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [side, throttledServerUpdate, gameReady]);

  // 스킬 토글 함수
  const toggleSkill = useCallback((skillId) => {
    console.log('스킬 토글:', skillId, '현재 활성화:', selectedSkillId);
    
    // 이미 활성화된 스킬을 다시 누르면 비활성화
    if (selectedSkillId === skillId) {
      console.log('스킬 비활성화');
      setSelectedSkillId(null);
    } else {
      // 다른 스킬 활성화 (기존 스킬은 자동으로 비활성화됨)
      console.log('스킬 활성화');
      setSelectedSkillId(skillId);
    }
  }, [selectedSkillId]);

  // 키보드 스킬 활성화/비활성화
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!side) return;
      
      // 스킬 키 처리 - 토글 방식
      if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
        const skillId = parseInt(e.key);
        toggleSkill(skillId);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [side, toggleSkill]);

  // 선택된 스킬 정보를 서버에 전송
  useEffect(() => {
    if (side && socketRef.current && selectedSkillId !== null) {
      console.log('서버에 스킬 활성화 전송:', selectedSkillId);
      socketRef.current.emit("set_selected_skill", { 
        room, 
        side, 
        skill_id: selectedSkillId 
      });
    } else if (side && socketRef.current && selectedSkillId === null) {
      // 선택 해제 시
      console.log('서버에 스킬 비활성화 전송');
      socketRef.current.emit("set_selected_skill", { 
        room, 
        side, 
        skill_id: 0 
      });
    }
  }, [selectedSkillId, side, room]);

    // 🔥 핵심: 서버 위치와 로컬 위치를 비교해서 부드럽게 보정
  useEffect(() => {
    if (!serverPaddlePosition || !localPaddlePosition || !side) return;
    
    // 두 위치의 차이 계산
    const dx = serverPaddlePosition.x - localPaddlePosition.x;
    const dy = serverPaddlePosition.y - localPaddlePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 차이가 2픽셀 이상이면 보정
    if (distance > 2) {
      // 부드럽게 보정 (lerp: linear interpolation)
      const correctionSpeed = 0.2; // 보정 속도 (0.1~0.3 정도가 좋음)
      const newX = localPaddlePosition.x + dx * correctionSpeed;
      const newY = localPaddlePosition.y + dy * correctionSpeed;
      
      setLocalPaddlePosition({ x: newX, y: newY });
    } else {
      // 거의 같으면 서버 위치로 정확히 맞춤
      setLocalPaddlePosition(serverPaddlePosition);
    }
  }, [serverPaddlePosition, localPaddlePosition, side]);

  // 🔥 공 위치 보간: 서버 위치와 로컬 위치를 비교해서 부드럽게 보정
  useEffect(() => {
    if (!serverBallPosition) return;
    if (!localBallPosition) {
      // 최초에는 서버 위치로 맞춤
      setLocalBallPosition(serverBallPosition);
      return;
    }
    // 두 위치의 차이 계산
    const dx = serverBallPosition.x - localBallPosition.x;
    const dy = serverBallPosition.y - localBallPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 1) {
      // 부드럽게 보정 (lerp)
      const correctionSpeed = 0.25; // 공은 paddle보다 약간 빠르게 보정
      const newX = localBallPosition.x + dx * correctionSpeed;
      const newY = localBallPosition.y + dy * correctionSpeed;
      setLocalBallPosition({ x: newX, y: newY });
    } else {
      setLocalBallPosition(serverBallPosition);
    }
  }, [serverBallPosition, localBallPosition]);

  if (!gameReady) {
    return <p style={{textAlign:'center',marginTop:'3em',fontSize:'1.2em'}}>상대방을 기다리는 중…</p>;
  }
  const { ball, paddles, scores, skills } = state;

  // 로컬 패들 위치와 서버 패들 위치 병합
  const displayPaddles = {
    top: side === 'left' && localPaddlePosition ? localPaddlePosition : paddles.top,
    bottom: side === 'right' && localPaddlePosition ? localPaddlePosition : paddles.bottom
  };

  let sideLabel = '';
  if (side === 'left') sideLabel = '당신은 위쪽입니다 (마우스로 조작)';
  else if (side === 'right') sideLabel = '당신은 아래쪽입니다 (마우스로 조작)';
  else if (side === null) sideLabel = '';

  const mySkill = side === 'left' ? skills.top : side === 'right' ? skills.bottom : null;
  const myAvailableSkills = mySkill?.available || [];

  // 🔥 공 위치 보간 적용: localBallPosition이 있으면 그걸 사용
  const displayBall = localBallPosition || ball;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #a7bfe8 100%)', padding: '2em 0'
    }}>
      {/* 유저 정보 표시 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '20px',
        fontSize: '14px'
      }}>
        👤 {username}
      </div>

      <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: '1.1em', color: '#3b3b3b' }}>{sideLabel}</div>

      <div 
        ref={gameBoardRef}
        style={{
          width: W, height: H, background: 'linear-gradient(180deg, #e0e7ff 0%, #c7d2fe 100%)',
          borderRadius: 32, boxShadow: '0 8px 32px rgba(80,100,180,0.15)', position: 'relative', overflow: 'hidden', border: '4px solid #6366f1', marginBottom: 24,
          cursor: side ? 'crosshair' : 'default'
        }}
      >
        {/* 중앙 라인 */}
        <div style={{
          position: 'absolute', left: W/2-2, top: 0, width: 4, height: H, background: 'rgba(99,102,241,0.12)', zIndex: 1
        }} />
        
        {/* 위쪽 패들 (원형) */}
        <div style={{
          position: 'absolute', 
          left: displayPaddles.top.x - PR, 
          top: displayPaddles.top.y - PR,
          width: PR*2, 
          height: PR*2, 
          borderRadius: '50%',
          background: skills.top.active > 0 
            ? (() => {
                const activeSkill = skills.top.available.find(s => s.id === skills.top.active);
                return activeSkill 
                  ? `radial-gradient(circle at 30% 30%, ${activeSkill.color} 70%, ${activeSkill.color}dd 100%)` 
                  : 'radial-gradient(circle at 30% 30%, #6366f1 70%, #818cf8 100%)';
              })()
            : 'radial-gradient(circle at 30% 30%, #6366f1 70%, #818cf8 100%)', 
          boxShadow: skills.top.active > 0 
            ? (() => {
                const activeSkill = skills.top.available.find(s => s.id === skills.top.active);
                return activeSkill 
                  ? `0 2px 8px ${activeSkill.color}55, 0 0 20px ${activeSkill.color}` 
                  : '0 2px 8px #6366f155';
              })()
            : '0 2px 8px #6366f155', 
          zIndex: 2,
          transition: side === 'left' ? 'none' : 'all 0.3s ease', // 내 패들은 즉시 반응
          border: '2px solid rgba(255,255,255,0.3)'
        }} />
        
        {/* 아래쪽 패들 (원형) */}
        <div style={{
          position: 'absolute', 
          left: displayPaddles.bottom.x - PR, 
          top: displayPaddles.bottom.y - PR,
          width: PR*2, 
          height: PR*2, 
          borderRadius: '50%',
          background: skills.bottom.active > 0 
            ? (() => {
                const activeSkill = skills.bottom.available.find(s => s.id === skills.bottom.active);
                return activeSkill 
                  ? `radial-gradient(circle at 30% 30%, ${activeSkill.color} 70%, ${activeSkill.color}dd 100%)` 
                  : 'radial-gradient(circle at 30% 30%, #f59e42 70%, #fbbf24 100%)';
              })()
            : 'radial-gradient(circle at 30% 30%, #f59e42 70%, #fbbf24 100%)', 
          boxShadow: skills.bottom.active > 0 
            ? (() => {
                const activeSkill = skills.bottom.available.find(s => s.id === skills.bottom.active);
                return activeSkill 
                  ? `0 2px 8px ${activeSkill.color}55, 0 0 20px ${activeSkill.color}` 
                  : '0 2px 8px #f59e4255';
              })()
            : '0 2px 8px #f59e4255', 
          zIndex: 2,
          transition: side === 'right' ? 'none' : 'all 0.3s ease', // 내 패들은 즉시 반응
          border: '2px solid rgba(255,255,255,0.3)'
        }} />

        {/* 공 */}
        <div style={{
          position: 'absolute', left: displayBall.x - BR, top: displayBall.y - BR,
          width: BR*2, height: BR*2, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #f87171 70%, #991b1b 100%)', boxShadow: '0 2px 12px #991b1b33', zIndex: 3
        }} />
        {/* 점수 표시 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: H/2-40, textAlign: 'center', fontSize: '2.5em', fontWeight: 700, color: '#6366f1', opacity: 0.15, zIndex: 0
        }}>{scores.top} : {scores.bottom}</div>
      </div>

      {/* 스킬 버튼들 */}
      {side && myAvailableSkills.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.8em',
          marginBottom: '1em',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {myAvailableSkills.map(skill => {
            const isActive = mySkill?.active === skill.id;
            const isSelected = selectedSkillId === skill.id;
            
            return (
              <button
                key={skill.id}
                style={{
                  padding: '0.8em 1.2em',
                  fontSize: '1em',
                  fontWeight: 600,
                  borderRadius: 12,
                  background: isActive 
                    ? `linear-gradient(135deg, ${skill.color} 0%, ${skill.color}dd 100%)` 
                    : isSelected
                    ? `linear-gradient(135deg, ${skill.color}44 0%, ${skill.color}66 100%)`
                    : `linear-gradient(135deg, ${skill.color}22 0%, ${skill.color}44 100%)`,
                  color: isActive ? 'white' : skill.color,
                  cursor: 'default', // 마우스 클릭 비활성화
                  boxShadow: isActive 
                    ? `0 4px 16px ${skill.color}40` 
                    : isSelected
                    ? `0 4px 16px ${skill.color}30`
                    : `0 2px 8px ${skill.color}20`,
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  minWidth: 80,
                  border: isActive 
                    ? `2px solid ${skill.color}` 
                    : isSelected 
                    ? `2px solid ${skill.color}` 
                    : `2px solid ${skill.color}22`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ fontSize: '1.2em', marginBottom: '0.2em' }}>{skill.icon}</div>
                <div style={{ fontSize: '0.8em', fontWeight: 500 }}>{skill.multiplier}x</div>
                <div style={{ fontSize: '0.7em', color: '#666', marginTop: '0.1em' }}>
                  {skill.cooldown || 3.0}s
                </div>
                
                {/* 활성화 상태 표시 */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(45deg, transparent 30%, ${skill.color}22 50%, transparent 70%)`,
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: 12
                  }} />
                )}
                
                {/* 활성화된 스킬 표시 */}
                {isSelected && !isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 4,
                    right: 8,
                    fontSize: '0.7em',
                    color: skill.color,
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.9)',
                    padding: '2px 6px',
                    borderRadius: 8,
                    border: `1px solid ${skill.color}`
                  }}>
                    활성화됨
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{
        background: 'rgba(99,102,241,0.08)',
        borderRadius: 12,
        padding: '1em 2em',
        color: '#444',
        fontSize: '1em',
        boxShadow: '0 2px 8px #6366f122',
        marginBottom: 8
      }}>
        <b>조작법</b> <br/>
        패들 조작: <b>마우스</b> <br/>
        스킬 활성화/비활성화: <b>1-4</b> 키 (토글) <br/>
        스킬 발동: 공과 패들 충돌 시 자동 적용
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

    </div>
  );
}
