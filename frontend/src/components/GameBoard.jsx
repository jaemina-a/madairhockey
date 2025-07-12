import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// 세로형 에어하키 보드 크기
const W = 406, H = 700, PR = 15, BR = 12;

// 골대 설정
const GOAL_WIDTH = 120;
const GOAL_HEIGHT = 20;

// 스킬 정보 정의
const SKILLS = {
  1: { name: "스킬 1", icon: "⚡", multiplier: "1.5x", color: "#6366f1" },
  2: { name: "스킬 2", icon: "🔥", multiplier: "2.0x", color: "#f59e0b" },
  3: { name: "스킬 3", icon: "💨", multiplier: "2.5x", color: "#10b981" },
  4: { name: "스킬 4", icon: "🚀", multiplier: "3.0x", color: "#ef4444" }
};

export default function GameBoard() {
  const [state, setState] = useState(null);
  const [side, setSide] = useState(null);
  const [skillMessage, setSkillMessage] = useState("");
  const room = "default";
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SERVER_URL);
    socketRef.current = socket;
    socket.emit("join", { room });
    socket.on("joined", data => setSide(data.side));
    socket.on("state", data => setState(data));
    socket.on("skill_activated", data => {
      const skillInfo = SKILLS[data.skill_number];
      setSkillMessage(`${skillInfo.icon} ${skillInfo.name} 활성화! 공을 치면 속도가 ${skillInfo.multiplier} 증가합니다!`);
      setTimeout(() => setSkillMessage(""), 3000);
    });
    return () => {
      socket.off("joined");
      socket.off("state");
      socket.off("skill_activated");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const key = e => {
      let dx = 0, dy = 0;
      if (side === "left") {
        if (e.key === "a") dx = -15;
        if (e.key === "d") dx = +15;
        if (e.key === "w") dy = -15;
        if (e.key === "s") dy = +15;
        if (e.key === "1") socketRef.current?.emit("activate_skill", { room, side, skill_number: 1 });
        if (e.key === "2") socketRef.current?.emit("activate_skill", { room, side, skill_number: 2 });
        if (e.key === "3") socketRef.current?.emit("activate_skill", { room, side, skill_number: 3 });
        if (e.key === "4") socketRef.current?.emit("activate_skill", { room, side, skill_number: 4 });
      } else if (side === "right") {
        if (e.key === "ArrowLeft") dx = -15;
        if (e.key === "ArrowRight") dx = +15;
        if (e.key === "ArrowUp") dy = -15;
        if (e.key === "ArrowDown") dy = +15;
        if (e.key === "1") socketRef.current?.emit("activate_skill", { room, side, skill_number: 1 });
        if (e.key === "2") socketRef.current?.emit("activate_skill", { room, side, skill_number: 2 });
        if (e.key === "3") socketRef.current?.emit("activate_skill", { room, side, skill_number: 3 });
        if (e.key === "4") socketRef.current?.emit("activate_skill", { room, side, skill_number: 4 });
      }
      if ((dx !== 0 || dy !== 0) && side && socketRef.current) {
        socketRef.current.emit("paddle_move", { room, side, dx, dy });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [side]);

  const handleSkillClick = (skillNumber) => {
    if (side && socketRef.current) {
      socketRef.current.emit("activate_skill", { room, side, skill_number: skillNumber });
    }
  };

  if (!state) return <p style={{textAlign:'center',marginTop:'3em',fontSize:'1.2em'}}>대전 상대를 기다리는 중…</p>;
  const { ball, paddles, scores, skills } = state;

  let sideLabel = '';
  if (side === 'left') sideLabel = '당신은 위쪽입니다 (WASD 이동, 1-4 스킬)';
  else if (side === 'right') sideLabel = '당신은 아래쪽입니다 (화살표 이동, 1-4 스킬)';
  else if (side === null) sideLabel = '';

  const mySkill = side === 'left' ? skills.top : side === 'right' ? skills.bottom : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #a7bfe8 100%)', padding: '2em 0'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: '1.1em', color: '#3b3b3b' }}>{sideLabel}</div>
      
      {/* 스킬 메시지 */}
      {skillMessage && (
        <div style={{
          background: 'rgba(99,102,241,0.1)',
          border: '2px solid #6366f1',
          borderRadius: 12,
          padding: '0.8em 1.5em',
          marginBottom: '1em',
          color: '#6366f1',
          fontSize: '1em',
          fontWeight: 600,
          animation: 'fadeInOut 3s ease-in-out'
        }}>
          {skillMessage}
        </div>
      )}

      <div style={{
        width: W, height: H, background: 'linear-gradient(180deg, #e0e7ff 0%, #c7d2fe 100%)',
        borderRadius: 32, boxShadow: '0 8px 32px rgba(80,100,180,0.15)', position: 'relative', overflow: 'hidden', border: '4px solid #6366f1', marginBottom: 24
      }}>
        {/* 중앙 라인 */}
        <div style={{
          position: 'absolute', left: W/2-2, top: 0, width: 4, height: H, background: 'rgba(99,102,241,0.12)', zIndex: 1
        }} />
        
        {/* 위쪽 골대 */}
        <div style={{
          position: 'absolute',
          left: W/2 - GOAL_WIDTH/2,
          top: 0,
          width: GOAL_WIDTH,
          height: GOAL_HEIGHT,
          background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',
          border: '3px solid #92400e',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
          zIndex: 1
        }} />
        
        {/* 아래쪽 골대 */}
        <div style={{
          position: 'absolute',
          left: W/2 - GOAL_WIDTH/2,
          bottom: 0,
          width: GOAL_WIDTH,
          height: GOAL_HEIGHT,
          background: 'linear-gradient(180deg, #f59e0b 0%, #fbbf24 100%)',
          border: '3px solid #92400e',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          zIndex: 1
        }} />
        
        {/* 위쪽 패들 (원형) */}
        <div style={{
          position: 'absolute', 
          left: paddles.top.x - PR, 
          top: paddles.top.y - PR,
          width: PR*2, 
          height: PR*2, 
          borderRadius: '50%',
          background: skills.top.active > 0 
            ? `radial-gradient(circle at 30% 30%, ${SKILLS[skills.top.active].color} 70%, ${SKILLS[skills.top.active].color}dd 100%)` 
            : 'radial-gradient(circle at 30% 30%, #6366f1 70%, #818cf8 100%)', 
          boxShadow: skills.top.active > 0 
            ? `0 2px 8px ${SKILLS[skills.top.active].color}55, 0 0 20px ${SKILLS[skills.top.active].color}` 
            : '0 2px 8px #6366f155', 
          zIndex: 2,
          transition: 'all 0.3s ease',
          border: '2px solid rgba(255,255,255,0.3)'
        }} />
        
        {/* 아래쪽 패들 (원형) */}
        <div style={{
          position: 'absolute', 
          left: paddles.bottom.x - PR, 
          top: paddles.bottom.y - PR,
          width: PR*2, 
          height: PR*2, 
          borderRadius: '50%',
          background: skills.bottom.active > 0 
            ? `radial-gradient(circle at 30% 30%, ${SKILLS[skills.bottom.active].color} 70%, ${SKILLS[skills.bottom.active].color}dd 100%)` 
            : 'radial-gradient(circle at 30% 30%, #f59e42 70%, #fbbf24 100%)', 
          boxShadow: skills.bottom.active > 0 
            ? `0 2px 8px ${SKILLS[skills.bottom.active].color}55, 0 0 20px ${SKILLS[skills.bottom.active].color}` 
            : '0 2px 8px #f59e4255', 
          zIndex: 2,
          transition: 'all 0.3s ease',
          border: '2px solid rgba(255,255,255,0.3)'
        }} />
        
        {/* 공 */}
        <div style={{
          position: 'absolute', left: ball.x - BR, top: ball.y - BR,
          width: BR*2, height: BR*2, borderRadius: '50%', 
          background: 'radial-gradient(circle at 30% 30%, #f87171 70%, #991b1b 100%)', 
          boxShadow: '0 2px 12px #991b1b33', 
          zIndex: 3
        }} />
        
        {/* 점수 표시 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: H/2-40, textAlign: 'center', fontSize: '2.5em', fontWeight: 700, color: '#6366f1', opacity: 0.15, zIndex: 0
        }}>{scores.top} : {scores.bottom}</div>
      </div>

      {/* 스킬 버튼들 */}
      {side && (
        <div style={{
          display: 'flex',
          gap: '0.8em',
          marginBottom: '1em',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {[1, 2, 3, 4].map(skillNumber => {
            const skillInfo = SKILLS[skillNumber];
            const isActive = mySkill?.active === skillNumber;
            
            return (
              <button
                key={skillNumber}
                onClick={() => handleSkillClick(skillNumber)}
                style={{
                  padding: '0.8em 1.2em',
                  fontSize: '1em',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 12,
                  background: isActive 
                    ? `linear-gradient(135deg, ${skillInfo.color} 0%, ${skillInfo.color}dd 100%)` 
                    : `linear-gradient(135deg, ${skillInfo.color}22 0%, ${skillInfo.color}44 100%)`,
                  color: isActive ? 'white' : skillInfo.color,
                  cursor: 'pointer',
                  boxShadow: isActive 
                    ? `0 4px 16px ${skillInfo.color}40` 
                    : `0 2px 8px ${skillInfo.color}20`,
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  minWidth: 80,
                  border: isActive ? `2px solid ${skillInfo.color}` : `2px solid ${skillInfo.color}22`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ fontSize: '1.2em', marginBottom: '0.2em' }}>{skillInfo.icon}</div>
                <div style={{ fontSize: '0.8em', fontWeight: 500 }}>{skillInfo.multiplier}</div>
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(45deg, transparent 30%, ${skillInfo.color}22 50%, transparent 70%)`,
                    animation: 'shimmer 1.5s infinite'
                  }} />
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
        위쪽: <b>WASD</b> 이동, <b>1-4</b> 스킬 &nbsp;&nbsp; 아래쪽: <b>화살표</b> 이동, <b>1-4</b> 스킬
      </div>

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
