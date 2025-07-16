import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import socket from "../socket";
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
  const roomName = searchParams.get('room_name') || 'default'; // room_name 파라미터 추가
  
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
  const room = roomName; // room_name 사용
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
    // const socket = io(import.meta.env.VITE_SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    // 서버에 접속
    console.log("room : ", room);
    console.log("username : ", username);
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

      // 골대 효과 디버그 로그
      if (data.goal_width_ratio && (data.goal_width_ratio.top !== 0.5 || data.goal_width_ratio.bottom !== 0.5)) {
        console.log("서버에서 골대 효과 수신:", data.goal_width_ratio);
      }

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
        console.log("mySkillData.active:", mySkillData.active, "selectedSkillId:", selectedSkillId, typeof mySkillData.active, typeof selectedSkillId);
        if (mySkillData.active > 0 && Number(selectedSkillId)=== Number(mySkillData.active)) {
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
    socket.on("skill_activated", (data) => {

      setSelectedSkillId(null);
      // 3,4번: 내가 발동한 경우에만 토글 켜짐
      if (data.side === sideRef.current && (data.skill_id === 3 || data.skill_id === 4)) {
        setLocalActiveSkill({ id: data.skill_id, ts: Date.now() });
      }
      // 1,2번: 내가 발동한 경우에만 토글 꺼짐
      if (data.skill_id === 1 || data.skill_id === 2) {
        setSelectedSkillId(-1); // 임시값으로 변경 (렌더 유도)
        setTimeout(() => {
          setSelectedSkillId(null);
          // 1,2번: 스킬 효과 끝난 뒤(토글 off) 쿨타임 기록
          if (data.side === sideRef.current) {
            setSkillCooldowns(prev => ({ ...prev, [data.skill_id]: Date.now() }));
          }
        }, 0);
      }
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
    socketRef.current.emit("activate_skill", {
      room,
      side,
      skill_id: skillId
    });
    // 로컬에서도 즉시 활성화 표시
    setLocalActiveSkill({ id: skillId, ts: Date.now() });
  }, [side, room]);

  // 로컬 골대 효과 상태
  const [localGoalSkill, setLocalGoalSkill] = useState(null);

  // 3,4번 스킬 활성화 표시 타이머 관리
  useEffect(() => {
    if (!localActiveSkill) return;
    const duration = localActiveSkill.id === 3 ? 5000 : 3000;
    const timeout = setTimeout(() => {
      setLocalActiveSkill(null);
      // 3,4번 스킬: 효과 끝난 후 쿨타임 시작
      if (localActiveSkill.id === 3 || localActiveSkill.id === 4) {
        setSkillCooldowns(prev => ({ ...prev, [localActiveSkill.id]: Date.now() }));
      }
    }, duration);
    return () => clearTimeout(timeout);
  }, [localActiveSkill]);

  // 스킬별 마지막 사용 시각 (timestamp, ms)
  const [skillCooldowns, setSkillCooldowns] = useState({
    1: 0, // 스킬1
    2: 0, // 스킬2
    3: 0, // 스킬3
    4: 0  // 스킬4
  });
  // 쿨타임 상수 (ms)
  const SKILL_COOLDOWN = {
    1: 3000, // 3초
    2: 5000, // 5초
    3: 3000, // 3초
    4: 5000  // 5초
  };
  // 쿨타임 남은 시간(초)
  function getSkillCooldownLeft(skillId) {
    const now = Date.now();
    const lastUsed = skillCooldowns[skillId] || 0;
    const cooldown = SKILL_COOLDOWN[skillId];
    return Math.max(0, Math.ceil((lastUsed + cooldown - now) / 1000));
  }
  // 쿨타임 UI 실시간 갱신용 타이머
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceUpdate(v => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // 스킬 토글 함수
  const toggleSkill = useCallback((skillId) => {
    // 쿨타임 체크
    if (getSkillCooldownLeft(skillId) > 0) return;
    // 쿨타임 기록은 스킬 효과가 끝난 뒤에만!
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
  }, [selectedSkillId, activateGoalSkill, skillCooldowns]);

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

  
  /*useEffect(() => {
    let rafId;
    const animate = () => {
      setLocalPaddlePosition(prev => {
        if (!prev || !serverPaddlePosition) return serverPaddlePosition;
        const dx = serverPaddlePosition.x - prev.x;
        const dy = serverPaddlePosition.y - prev.y;
        return {
          x: prev.x + dx * 0.2,
          y: prev.y + dy * 0.2
        };
      });
      rafId = requestAnimationFrame(animate);
    };
    if (serverPaddlePosition) animate();
    return () => cancelAnimationFrame(rafId);
  }, [serverPaddlePosition]);
  
  // 🔥 공 위치 보간: 서버 위치와 로컬 위치를 비교해서 부드럽게 보정
  // 기존 useEffect는 주석 처리
  */
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

  
  /* useEffect(() => {
    let rafId;
    const animate = () => {
      setLocalBallPosition(prev => {
        if (!prev || !serverBallPosition) return serverBallPosition;
        const dx = serverBallPosition.x - prev.x;
        const dy = serverBallPosition.y - prev.y;
        return {
          x: prev.x + dx * 0.2,
          y: prev.y + dy * 0.2
        };
      });
      rafId = requestAnimationFrame(animate);
    };
    if (serverBallPosition) animate();
    return () => cancelAnimationFrame(rafId);
  }, [serverBallPosition]);
  */
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

  // 골대 비율 계산: 서버 상태 + 로컬 즉시 효과
  let goalWidthRatioTop = state.goal_width_ratio?.top ?? 0.5;
  let goalWidthRatioBottom = state.goal_width_ratio?.bottom ?? 0.5;
  

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
        {/* 점수 표시 (더 어두운 색상으로 변경) */}
        {/* 하키판 가운데 점수 표시 제거 */}
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
        {/* 사이드라벨(당신은 어느쪽입니다) 문장 흰색으로 */}
        <div style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#fff', marginBottom: 8 }}>{sideLabel}</div>
        {/* 스킬 버튼들 */}
        {side && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2em',
            marginBottom: '1em',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
          }}>
            {/* 위쪽: 가속 스킬 1,2 (노란색 디자인 완전 통일) */}
            <div style={{ display: 'flex', gap: '0.8em', justifyContent: 'center' }}>
              {[1,2].map(id => {
                // 1번과 2번 모두 노란색(#f59e0b) 디자인(활성화/비활성화/선택 모두)
                const baseColor = '#f59e0b';
                const skill = myAvailableSkills.find(s => s.id === id) || {
                  id,
                  icon: id===1?"⚡":"🔥",
                  color: baseColor,
                  multiplier: id===1?1.5:2.0,
                  cooldown: 0,
                  name: id===1?"스킬 1":"스킬 2"
                };
                const isActive = (mySkill?.active === skill.id);
                const isSelected = Number(selectedSkillId) === Number(skill.id);
                return (
                  <button
                    key={skill.id}
                    style={{
                      padding: '0.7em 1.1em',
                      fontSize: '1em',
                      fontWeight: 600,
                      borderRadius: 6,
                      background: isActive
                        ? baseColor
                        : isSelected
                        ? `${baseColor}88`
                        : `#e0e7ef`,
                      color: isActive ? '#fff' : baseColor,
                      cursor: 'pointer',
                      boxShadow: isActive 
                        ? `0 2px 8px ${baseColor}55, 0 0 8px #1e293b` 
                        : isSelected
                        ? `0 2px 8px ${baseColor}33`
                        : `0 2px 8px #1e293b22`,
                      transition: 'all 0.2s',
                      outline: 'none',
                      minWidth: 70,
                      border: isActive 
                        ? `2px solid #fff` 
                        : isSelected 
                        ? `2px solid ${baseColor}` 
                        : `2px solid #1e293b`,
                      position: 'relative',
                      overflow: 'hidden',
                      fontFamily: 'monospace',
                      imageRendering: 'pixelated',
                    }}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    <div style={{ fontSize: '1.2em', marginBottom: '0.2em' }}>{skill.icon}</div>
                    <div style={{ fontSize: '0.8em', fontWeight: 500 }}>{skill.multiplier}x</div>
                    {/* '즉시' 텍스트 제거 */}
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `${baseColor}44`,
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
                        color: baseColor,
                        fontWeight: 700,
                        background: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: `1px solid ${baseColor}`,
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
            {/* 아래쪽: 골대 스킬 3,4 (쿨타임 디자인/스타일 통일) */}
            <div style={{ display: 'flex', gap: '0.8em', justifyContent: 'center' }}>
              {[3,4].map(id => {
                // 3번과 4번 모두 동일한 색상/디자인(3번 기준)
                const baseColor = '#0ea5e9';
                const skill = myAvailableSkills.find(s => s.id === id) || {
                  id,
                  icon: id===3?"🛡️":"🧊",
                  color: baseColor,
                  cooldown: id===3?3.0:5.0,
                  name: id===3?"골대 축소 1":"골대 축소 2"
                };
                const isActive = (mySkill?.active === skill.id) || (localActiveSkill && localActiveSkill.id === id);
                const isSelected = localActiveSkill && localActiveSkill.id === skill.id;
                // 골대 스킬 표시 텍스트
                const ratioText = id === 3 ? '1/2' : '1/4';
                const cooldownLeft = getSkillCooldownLeft(skill.id);
                // 쿨타임 중이면 연한 회색 배경
                const isCooldown = cooldownLeft > 0;
                return (
                  <button
                    key={skill.id}
                    disabled={isCooldown}
                    style={{
                      padding: '0.7em 1.1em',
                      fontSize: '1em',
                      fontWeight: 600,
                      borderRadius: 6,
                      background: isCooldown
                        ? 'rgba(120,120,120,0.13)'
                        : isActive
                        ? baseColor
                        : isSelected
                        ? `${baseColor}88`
                        : `#e0e7ef`,
                      color: isActive ? '#fff' : baseColor,
                      cursor: 'pointer',
                      boxShadow: isActive 
                        ? `0 2px 8px ${baseColor}55, 0 0 8px #1e293b` 
                        : isSelected
                        ? `0 2px 8px ${baseColor}33`
                        : `0 2px 8px #1e293b22`,
                      transition: 'all 0.2s',
                      outline: 'none',
                      minWidth: 70,
                      border: isActive 
                        ? `2px solid #fff` 
                        : isSelected 
                        ? `2px solid ${baseColor}` 
                        : `2px solid #1e293b`,
                      position: 'relative',
                      overflow: 'hidden',
                      fontFamily: 'monospace',
                      imageRendering: 'pixelated',
                    }}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    <div style={{ fontSize: '1.2em', marginBottom: '0.2em', fontWeight: 700 }}>{skill.icon}</div>
                    <div style={{ fontSize: '0.8em', fontWeight: 700 }}>{ratioText}</div>
                    {isCooldown ? (
                      <div style={{ color: '#222', fontWeight: 700, fontSize: '0.9em' }}>{cooldownLeft}s</div>
                    ) : (
                      <div style={{ fontSize: '0.7em', color: '#666', marginTop: '0.1em' }}>{id === 3 ? '3s' : '5s'}</div>
                    )}
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `${baseColor}44`,
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
                        color: baseColor,
                        fontWeight: 700,
                        background: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: `1px solid ${baseColor}`,
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
          </div>
        )}
        {/* 설명 (조작법 텍스트 변경) */}
        <div style={{
          background: 'rgba(99,102,241,0.08)',
          borderRadius: 12,
          padding: '1em 2em',
          color: '#f3f4f6',
          fontSize: '1em',
          boxShadow: '0 2px 8px #6366f122',
          marginBottom: 8,
        }}>
          <div>- 마우스를 움직여 패들 조작</div>
          <div>- 1,2: 가속 스킬 발동</div>
          <div>- 3,4: 방어 스킬 발동</div>
        </div>
      </div>

      {/* 점수/아이디 표시: 우측 아래(내 점수+내 아이디), 좌측 상단(상대 점수+상대 아이디) */}
      {/* 내 점수+내 아이디 (우측 아래) */}
      <div style={{
        position: 'fixed',
        right: '3vw',
        bottom: '2vh',
        background: 'rgba(30,41,59,0.92)',
        color: '#fff',
        fontWeight: 700,
        fontSize: '1.3em',
        borderRadius: 12,
        padding: '0.5em 1.2em',
        zIndex: 20,
        boxShadow: '0 2px 12px #0ea5e955',
        fontFamily: 'monospace',
        letterSpacing: '0.03em',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: '1.5em', fontWeight: 900 }}>{side === 'left' ? scores.top : scores.bottom}</span>
        <span style={{ fontSize: '0.9em', opacity: 0.8 }}>{username}</span>
      </div>
      {/* 상대 점수+상대 아이디 (좌측 상단) */}
      <div style={{
        position: 'fixed',
        left: '3vw',
        top: '2vh',
        background: 'rgba(30,41,59,0.92)',
        color: '#fff',
        fontWeight: 700,
        fontSize: '1.3em',
        borderRadius: 12,
        padding: '0.5em 1.2em',
        zIndex: 20,
        boxShadow: '0 2px 12px #0ea5e955',
        fontFamily: 'monospace',
        letterSpacing: '0.03em',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ fontSize: '1.5em', fontWeight: 900 }}>{side === 'left' ? scores.bottom : scores.top}</span>
        <span style={{ fontSize: '0.9em', opacity: 0.8 }}>{side === 'left' ? (state?.usernames?.bottom || '상대') : (state?.usernames?.top || '상대')}</span>
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
