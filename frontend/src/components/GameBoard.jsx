import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

// 세로형 에어하키 보드 크기
const W = 406, H = 700, PR = 15, BR = 12;

// 골대 설정
const GOAL_WIDTH = 120;
const GOAL_HEIGHT = 20;

export default function GameBoard() {
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1';
  
  const [state, setState] = useState(null);
  const [side, setSide] = useState(null);
  const [userSkills, setUserSkills] = useState([]);
  const room = "default";
  const socketRef = useRef(null);

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

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SERVER_URL);
    socketRef.current = socket;
    socket.emit("join", { room, username });
    socket.on("joined", data => setSide(data.side));
    socket.on("state", data => setState(data));
    return () => {
      socket.off("joined");
      socket.off("state");
      socket.disconnect();
    };
  }, [username]);

  useEffect(() => {
    const key = e => {
      let dx = 0;
      let dy = 0;
      if (side === "left") {
        if (e.key === "a") dx = -15;
        if (e.key === "d") dx = +15;
        if (e.key === "w") dy = -15;
        if (e.key === "s") dy = +15;
        if (e.key === "1") socketRef.current?.emit("activate_skill", { room, side, skill_id: 1 });
        if (e.key === "2") socketRef.current?.emit("activate_skill", { room, side, skill_id: 2 });
        if (e.key === "3") socketRef.current?.emit("activate_skill", { room, side, skill_id: 3 });
        if (e.key === "4") socketRef.current?.emit("activate_skill", { room, side, skill_id: 4 });
      } else if (side === "right") {
        if (e.key === "ArrowLeft") dx = -15;
        if (e.key === "ArrowRight") dx = +15;
        if (e.key === "ArrowUp") dy = -15;
        if (e.key === "ArrowDown") dy = +15;
        if (e.key === "1") socketRef.current?.emit("activate_skill", { room, side, skill_id: 1 });
        if (e.key === "2") socketRef.current?.emit("activate_skill", { room, side, skill_id: 2 });
        if (e.key === "3") socketRef.current?.emit("activate_skill", { room, side, skill_id: 3 });
        if (e.key === "4") socketRef.current?.emit("activate_skill", { room, side, skill_id: 4 });
      }
      if ((dx !== 0 || dy !== 0) && side && socketRef.current) {
        socketRef.current.emit("paddle_move", { room, side, dx, dy });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [side]);

  const handleSkillClick = (skillId) => {
    if (side && socketRef.current) {
      socketRef.current.emit("activate_skill", { room, side, skill_id: skillId });
    }
  };

  if (!state) return <p style={{textAlign:'center',marginTop:'3em',fontSize:'1.2em'}}>대전 상대를 기다리는 중…</p>;
  const { ball, paddles, scores, skills } = state;

  let sideLabel = '';
  if (side === 'left') sideLabel = '당신은 위쪽입니다 (WASD)';
  else if (side === 'right') sideLabel = '당신은 아래쪽입니다 (←↑↓→)';
  else if (side === null) sideLabel = '';

  const mySkill = side === 'left' ? skills.top : side === 'right' ? skills.bottom : null;
  const myAvailableSkills = mySkill?.available || [];

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

      <div style={{
        width: W, height: H, background: 'linear-gradient(180deg, #e0e7ff 0%, #c7d2fe 100%)',
        borderRadius: 32, boxShadow: '0 8px 32px rgba(80,100,180,0.15)', position: 'relative', overflow: 'hidden', border: '4px solid #6366f1', marginBottom: 24
      }}>
        {/* 중앙 라인 */}
        <div style={{
          position: 'absolute', left: W/2-2, top: 0, width: 4, height: H, background: 'rgba(99,102,241,0.12)', zIndex: 1
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
          transition: 'all 0.3s ease',
          border: '2px solid rgba(255,255,255,0.3)'
        }} />

        {/* 공 */}
        <div style={{
          position: 'absolute', left: ball.x - BR, top: ball.y - BR,
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
            
            return (
              <button
                key={skill.id}
                onClick={() => handleSkillClick(skill.id)}
                style={{
                  padding: '0.8em 1.2em',
                  fontSize: '1em',
                  fontWeight: 600,
                  borderRadius: 12,
                  background: isActive 
                    ? `linear-gradient(135deg, ${skill.color} 0%, ${skill.color}dd 100%)` 
                    : `linear-gradient(135deg, ${skill.color}22 0%, ${skill.color}44 100%)`,
                  color: isActive ? 'white' : skill.color,
                  cursor: 'pointer',
                  boxShadow: isActive 
                    ? `0 4px 16px ${skill.color}40` 
                    : `0 2px 8px ${skill.color}20`,
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  minWidth: 80,
                  border: isActive ? `2px solid ${skill.color}` : `2px solid ${skill.color}22`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ fontSize: '1.2em', marginBottom: '0.2em' }}>{skill.icon}</div>
                <div style={{ fontSize: '0.8em', fontWeight: 500 }}>{skill.multiplier}x</div>
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(45deg, transparent 30%, ${skill.color}22 50%, transparent 70%)`,
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
        위쪽: <b>WASD</b> &nbsp;&nbsp; 아래쪽: <b>←↑↓→</b> <br/>
        스킬: <b>1-4</b> 키 또는 버튼 클릭
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
