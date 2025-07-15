import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import fry_audio from "../assets/audio/audio_fry.mp3";
import malletRedImg from '../assets/mallet_red.png';
import puckImg from '../assets/puck.png';

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
  const animationRef = useRef(); // 추가: 공 보간용 애니메이션 프레임 ref
  const targetBallPositionRef = useRef(null); // rAF 보간용 목표점
  const MAX_SPEED = 10;
  const [goalAnim, setGoalAnim] = useState(false); // 득점 애니메이션 상태
  const [goalAnimPos, setGoalAnimPos] = useState(null); // 득점 애니메이션용 위치
  const prevScores = useRef(null); // 이전 점수 저장

  // 유저 스킬 가져오기
  useEffect(() => {
    const fetchUserSkills = async () => {
      try {
        const response = await fetch(`/api/user/skills?username=${encodeURIComponent(username)}`);
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

      //    핵심: 게임 시작할 때 로컬 위치 초기화
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
      setLocalBallPosition(null);
      
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

  // 3,4번 스킬 활성화 상태(로컬) 관리
  const [localActiveSkill, setLocalActiveSkill] = useState(null); // {id, ts}

  // 스킬 즉시 발동 함수 (3,4번)
  const activateGoalSkill = useCallback((skillId) => {
    if (!side || !socketRef.current) return;
    // 서버에 즉시 발동 요청
    socketRef.current.emit("set_selected_skill", {
      room,
      side,
      skill_id: skillId
    });
    // 로컬에서도 즉시 골대 줄이기(시각 효과)
    setLocalGoalSkill({ id: skillId, ts: Date.now() });
    setLocalActiveSkill({ id: skillId, ts: Date.now() });
  }, [side, room]);

  // 로컬 골대 효과 상태
  const [localGoalSkill, setLocalGoalSkill] = useState(null);

  // 3,4번 스킬 활성화 표시 타이머 관리
  useEffect(() => {
    if (!localActiveSkill) return;
    const now = Date.now();
    const duration = localActiveSkill.id === 3 ? 5000 : 3000;
    if (now - localActiveSkill.ts >= duration) {
      setLocalActiveSkill(null);
    } else {
      const timeout = setTimeout(() => setLocalActiveSkill(null), duration - (now - localActiveSkill.ts));
      return () => clearTimeout(timeout);
    }
  }, [localActiveSkill]);

  // 스킬 토글 함수
  const toggleSkill = useCallback((skillId) => {
    if (skillId === 3 || skillId === 4) {
      activateGoalSkill(skillId);
      return;
    }
    // 기존 방식(1,2번)
    if (selectedSkillId === skillId) {
      setSelectedSkillId(null);
    } else {
      setSelectedSkillId(skillId);
    }
  }, [selectedSkillId, activateGoalSkill]);

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
    if (selectedSkillId === 3 || selectedSkillId === 4) return; // 3,4번은 위에서 즉시 처리
    if (side && socketRef.current && selectedSkillId !== null) {
      socketRef.current.emit("set_selected_skill", { 
        room, 
        side, 
        skill_id: selectedSkillId 
      });
    } else if (side && socketRef.current && selectedSkillId === null) {
      socketRef.current.emit("set_selected_skill", { 
        room, 
        side, 
        skill_id: 0 
      });
    }
  }, [selectedSkillId, side, room]);

    // �� 핵심: 서버 위치와 로컬 위치를 비교해서 부드럽게 보정
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
  // 기존 useEffect는 주석 처리
  
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

    if (distance > 2) {
      let moveX = dx;
      let moveY = dy;


      const newX = localBallPosition.x + moveX;
      const newY = localBallPosition.y + moveY;
      setLocalBallPosition({ x: newX, y: newY });
    } else {
      setLocalBallPosition(serverBallPosition);
    }

  }, [serverBallPosition, localBallPosition]);

  // requestAnimationFrame 기반 공 위치 보간 useEffect 추가
  /*useEffect(() => {
    if (!serverBallPosition) return;
    if (!localBallPosition) {
      setLocalBallPosition(serverBallPosition);
      return;
    }
    let stopped = false;
    function animate() {
      if (stopped) return;
      setLocalBallPosition(prev => {
        if (!prev) return serverBallPosition;
        const dx = serverBallPosition.x - prev.x;
        const dy = serverBallPosition.y - prev.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const correctionSpeed = 0.25;
        if (distance > 0.5) {
          return {
            x: prev.x + dx * correctionSpeed,
            y: prev.y + dy * correctionSpeed,
          };
        } else {
          return serverBallPosition;
        }
      });
      animationRef.current = requestAnimationFrame(animate);
    }
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      stopped = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [serverBallPosition]);
*/
/*
  useEffect(() => {
    if (!serverBallPosition) return;
    if (!serverBallPosition.timestamp) {
      console.warn("서버에서 timestamp가 안 왔어요!");
      return;
    }

    let stopped = false;
    function animate() {
      if (stopped) return;

      setLocalBallPosition(prev => {
        if (!prev) return serverBallPosition;

        const now = Date.now();  // 현재 시간(ms)
        const elapsed = now - serverBallPosition.timestamp;  // 공이 서버에서 보낸 후 지난 시간
        const dx = serverBallPosition.x - prev.x;
        const dy = serverBallPosition.y - prev.y;
        const t = Math.min(elapsed / 100, 1);  // 최대 100ms 기준으로 보간 (너무 튀지 않게)

        return {
          x: prev.x + dx * t,
          y: prev.y + dy * t,
        };
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      stopped = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [serverBallPosition]);
*/

  // 점수 변화(득점) 감지 → 애니메이션 트리거
  useEffect(() => {
    if (!state || !state.scores) return;
    if (!prevScores.current) {
      prevScores.current = { ...state.scores };
      return;
    }
    if (
      state.scores.top !== prevScores.current.top ||
      state.scores.bottom !== prevScores.current.bottom
    ) {
      // 득점 직전 공 위치 저장
      setGoalAnimPos(localBallPosition || serverBallPosition || displayBall);
      setGoalAnim(true);
      setTimeout(() => {
        setGoalAnim(false);
        setGoalAnimPos(null);
      }, 500);
    }
    prevScores.current = { ...state.scores };
  }, [state && state.scores && state.scores.top, state && state.scores && state.scores.bottom]);


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

  // 하키판 비율 및 최대 크기 계산
  const aspectRatio = 1 / 2;
  const maxBoardHeight = typeof window !== 'undefined' ? window.innerHeight * 0.9 : 700;
  const maxBoardWidth = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 406;
  let boardHeight = Math.min(maxBoardHeight, maxBoardWidth / aspectRatio);
  let boardWidth = boardHeight * aspectRatio;
  if (boardWidth > maxBoardWidth) {
    boardWidth = maxBoardWidth;
    boardHeight = boardWidth / aspectRatio;
  }

  // 패들/공 크기도 비율에 맞게 조정
  const PR_scaled = boardWidth / 8.12; // 406/8.12 ≈ 50, 기존 PR=25
  let BR_scaled = boardWidth / 16.92; // 406/16.92 ≈ 24, 기존 BR=12
  BR_scaled = BR_scaled * 1.5; // 퍽(공) 크기를 1.5배로 키움

  // 내 골대만 로컬에서 즉시 줄이기(3,4번 누를 때)
  let goalWidthRatioTop = state.goal_width_ratio?.top ?? 0.5;
  let goalWidthRatioBottom = state.goal_width_ratio?.bottom ?? 0.5;
  if (localGoalSkill && side) {
    const now = Date.now();
    if (side === 'left' && localGoalSkill.id === 3 && now - localGoalSkill.ts < 5000) goalWidthRatioTop = 0.5 * 0.7;
    if (side === 'left' && localGoalSkill.id === 4 && now - localGoalSkill.ts < 3000) goalWidthRatioTop = 0.5 * 0.5;
    if (side === 'right' && localGoalSkill.id === 3 && now - localGoalSkill.ts < 5000) goalWidthRatioBottom = 0.5 * 0.7;
    if (side === 'right' && localGoalSkill.id === 4 && now - localGoalSkill.ts < 3000) goalWidthRatioBottom = 0.5 * 0.5;
    // 효과 끝나면 리셋
    if ((localGoalSkill.id === 3 && now - localGoalSkill.ts >= 5000) || (localGoalSkill.id === 4 && now - localGoalSkill.ts >= 3000)) setLocalGoalSkill(null);
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        background: `url('/src/assets/gameboard_bg.png') center/cover no-repeat`,
        boxSizing: 'border-box',
        padding: 0
      }}
    >
      {/* 중앙 하키판 */}
      <div 
        ref={gameBoardRef}
        style={{
          width: boardWidth,
          height: boardHeight,
          background: `
            repeating-linear-gradient(0deg, #e0e7ef 0 2px, transparent 2px 20px),
            repeating-linear-gradient(90deg, #e0e7ef 0 2px, transparent 2px 20px),
            #fff
          `,
          imageRendering: 'pixelated',
          borderRadius: 24,
          boxShadow: '0 8px 32px #0ea5e955',
          position: 'relative',
          overflow: 'hidden',
          border: '6px solid #38bdf8',
          margin: '0 0',
          cursor: side ? 'crosshair' : 'default',
        }}
      >
        {/* 상단 골대 표시 (top) */}
        <div style={{
          position: 'absolute',
          left: boardWidth * (1 - goalWidthRatioTop) / 2,
          top: 0,
          width: boardWidth * goalWidthRatioTop,
          height: 10,
          background: 'repeating-linear-gradient(135deg, #374151 0 6px, #e5e7eb 6px 12px)',
          borderBottom: 'none',
          borderRadius: '0 0 12px 12px',
          zIndex: 2,
          imageRendering: 'pixelated',
        }} />
        {/* 하단 골대 표시 (bottom) */}
        <div style={{
          position: 'absolute',
          left: boardWidth * (1 - goalWidthRatioBottom) / 2,
          top: boardHeight - 10,
          width: boardWidth * goalWidthRatioBottom,
          height: 10,
          background: 'repeating-linear-gradient(135deg, #374151 0 6px, #e5e7eb 6px 12px)',
          borderTop: 'none',
          borderRadius: '12px 12px 0 0',
          zIndex: 2,
          imageRendering: 'pixelated',
        }} />
        {/* 중앙 가로선 */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: boardHeight/2-2.5,
          width: boardWidth,
          height: 5,
          background: '#bae6fd', // 연파랑
          zIndex: 1,
          boxShadow: 'none',
          imageRendering: 'pixelated',
        }} />
        {/* 중앙 원 */}
        <div style={{
          position: 'absolute',
          left: boardWidth/2-0.1*boardWidth, top: boardHeight/2-0.1*boardWidth, width: 0.2*boardWidth, height: 0.2*boardWidth,
          border: '5px solid #bae6fd', // 중앙선과 굵기 맞춤
          borderRadius: '50%',
          zIndex: 1,
          boxShadow: 'none',
          background: 'transparent',
          imageRendering: 'pixelated',
        }} />
        {/* 위쪽 패들 (이미지) */}
        <img
          src={malletRedImg}
          alt="red mallet"
          style={{
            position: 'absolute',
            left: displayPaddles.top.x / W * boardWidth - PR_scaled,
            top: displayPaddles.top.y / H * boardHeight - PR_scaled,
            width: PR_scaled * 2,
            height: PR_scaled * 2,
            zIndex: 2,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        {/* 아래쪽 패들 (이미지) */}
        <img
          src={malletRedImg}
          alt="red mallet"
          style={{
            position: 'absolute',
            left: displayPaddles.bottom.x / W * boardWidth - PR_scaled,
            top: displayPaddles.bottom.y / H * boardHeight - PR_scaled,
            width: PR_scaled * 2,
            height: PR_scaled * 2,
            zIndex: 2,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        {/* 공 (이미지) */}
        {!goalAnim && (
          <img
            src={puckImg}
            alt="puck"
            style={{
              position: 'absolute',
              left: displayBall.x / W * boardWidth - BR_scaled,
              top: displayBall.y / H * boardHeight - BR_scaled,
              width: BR_scaled * 2,
              height: BR_scaled * 2,
              zIndex: 3,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )}
        {/* 득점 애니메이션용 가짜 공 */}
        {goalAnim && goalAnimPos && (
          <img
            src={puckImg}
            alt="goal-puck"
            className="goal-puck-anim"
            style={{
              position: 'absolute',
              left: goalAnimPos.x / W * boardWidth - BR_scaled,
              top: goalAnimPos.y / H * boardHeight - BR_scaled,
              width: BR_scaled * 2,
              height: BR_scaled * 2,
              zIndex: 4,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )}
        {/* 점수 표시 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: boardHeight/2-40, textAlign: 'center', fontSize: '2.5em', fontWeight: 700, color: '#2563eb', opacity: 0.22, zIndex: 0,
          textShadow: '0 0 2px #1e293b, 0 0 8px #0ea5e9',
          fontFamily: 'monospace',
        }}>{scores.top} : {scores.bottom}</div>
      </div>
      {/* 오른쪽 사이드바 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        marginLeft: '6vw', // 기존 32에서 더 오른쪽으로
        minWidth: 220,
        maxWidth: 320,
        height: '90vh',
        gap: 16,
      }}>
        {/* 유저 정보 표시 */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '20px',
          fontSize: '14px',
          marginBottom: 8,
        }}>
          👤 {username}
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#3b3b3b', marginBottom: 8 }}>{sideLabel}</div>
        {/* 스킬 버튼들 */}
        {side && (
          <div style={{
            display: 'flex',
            gap: '0.8em',
            marginBottom: '1em',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
          }}>
            {[1,2,3,4].map(id => {
              const skill = myAvailableSkills.find(s => s.id === id) || {
                id,
                icon: id===1?"⚡":id===2?"🔥":id===3?"🛡️":"🧊",
                color: id===1?"#6366f1":id===2?"#f59e0b":id===3?"#0ea5e9":"#1e293b",
                multiplier: id===1?1.5:id===2?2.0:0,
                cooldown: 3.0,
                name: id===1?"스킬 1":id===2?"스킬 2":id===3?"골대 축소 1":"골대 축소 2"
              };
              const isActive = (mySkill?.active === skill.id) || (id >= 3 && localActiveSkill && localActiveSkill.id === id);
              const isSelected = selectedSkillId === skill.id;
              return (
                <button
                  key={skill.id}
                  style={{
                    padding: '0.7em 1.1em',
                    fontSize: '1em',
                    fontWeight: 600,
                    borderRadius: 6,
                    background: isActive 
                      ? skill.color
                      : isSelected
                      ? `${skill.color}88`
                      : `#e0e7ef`,
                    color: isActive ? '#fff' : skill.color,
                    cursor: 'pointer',
                    boxShadow: isActive 
                      ? `0 2px 8px ${skill.color}55, 0 0 8px #1e293b` 
                      : isSelected
                      ? `0 2px 8px ${skill.color}33`
                      : `0 2px 8px #1e293b22`,
                    transition: 'all 0.2s',
                    outline: 'none',
                    minWidth: 70,
                    border: isActive 
                      ? `2px solid #fff` 
                      : isSelected 
                      ? `2px solid ${skill.color}` 
                      : `2px solid #1e293b`,
                    position: 'relative',
                    overflow: 'hidden',
                    fontFamily: 'monospace',
                    imageRendering: 'pixelated',
                  }}
                  onClick={() => toggleSkill(skill.id)}
                >
                  <div style={{ fontSize: '1.2em', marginBottom: '0.2em' }}>{skill.icon}</div>
                  {id<=2 ? (
                    <div style={{ fontSize: '0.8em', fontWeight: 500 }}>{skill.multiplier}x</div>
                  ) : (
                    <div style={{ fontSize: '0.8em', fontWeight: 500 }}>골대 축소</div>
                  )}
                  <div style={{ fontSize: '0.7em', color: '#666', marginTop: '0.1em' }}>
                    {skill.cooldown || 3.0}s
                  </div>
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: `${skill.color}44`,
                      animation: 'shimmer 1.5s infinite',
                      borderRadius: 6,
                      imageRendering: 'pixelated',
                    }} />
                  )}
                  {isSelected && !isActive && (
                    <div style={{
                      position: 'absolute',
                      top: 4,
                      right: 8,
                      fontSize: '0.7em',
                      color: skill.color,
                      fontWeight: 700,
                      background: '#fff',
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: `1px solid ${skill.color}`,
                      fontFamily: 'monospace',
                      imageRendering: 'pixelated',
                    }}>
                      활성화됨
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {/* 설명 */}
        <div style={{
          background: 'rgba(99,102,241,0.08)',
          borderRadius: 12,
          padding: '1em 2em',
          color: '#444',
          fontSize: '1em',
          boxShadow: '0 2px 8px #6366f122',
          marginBottom: 8,
        }}>
          <b>조작법</b> <br/>
          패들 조작: <b>마우스</b> <br/>
          스킬 활성화/비활성화: <b>1-4</b> 키 (토글) <br/>
          스킬 발동: 공과 패들 충돌 시 자동 적용
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .goal-puck-anim {
          animation: fadeShrink 0.5s forwards;
        }
        @keyframes fadeShrink {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.3); }
        }
      `}</style>

    </div>
  );
}
