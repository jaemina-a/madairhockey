import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// 세로형 에어하키 보드 크기
const W = 406, H = 700, PW = 80, PH = 10, BR = 12;

export default function GameBoard() {
  const [state, setState] = useState(null);
  const [side, setSide] = useState(null);
  const room = "default";
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SERVER_URL);
    socketRef.current = socket;
    socket.emit("join", { room });
    socket.on("joined", data => setSide(data.side));
    socket.on("state", data => setState(data));
    return () => {
      socket.off("joined");
      socket.off("state");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const key = e => {
      let dx = 0;
      if (side === "left") {
        if (e.key === "a") dx = -15;
        if (e.key === "d") dx = +15;
      } else if (side === "right") {
        if (e.key === "ArrowLeft") dx = -15;
        if (e.key === "ArrowRight") dx = +15;
      }
      if (dx && side && socketRef.current) socketRef.current.emit("paddle_move", { room, side, dx });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [side]);

  if (!state) return <p style={{textAlign:'center',marginTop:'3em',fontSize:'1.2em'}}>대전 상대를 기다리는 중…</p>;
  const { ball, paddles, scores } = state;

  let sideLabel = '';
  if (side === 'left') sideLabel = '당신은 위쪽입니다 (A/D)';
  else if (side === 'right') sideLabel = '당신은 아래쪽입니다 (←/→)';
  else if (side === null) sideLabel = '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #a7bfe8 100%)', padding: '2em 0'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: '1.1em', color: '#3b3b3b' }}>{sideLabel}</div>
      <div style={{
        width: W, height: H, background: 'linear-gradient(180deg, #e0e7ff 0%, #c7d2fe 100%)',
        borderRadius: 32, boxShadow: '0 8px 32px rgba(80,100,180,0.15)', position: 'relative', overflow: 'hidden', border: '4px solid #6366f1', marginBottom: 24
      }}>
        {/* 중앙 라인 */}
        <div style={{
          position: 'absolute', left: W/2-2, top: 0, width: 4, height: H, background: 'rgba(99,102,241,0.12)', zIndex: 1
        }} />
        {/* 위쪽 패들 */}
        <div style={{
          position: 'absolute', left: paddles.top, top: 0,
          width: PW, height: PH, background: 'linear-gradient(90deg,#6366f1 60%,#818cf8 100%)', borderRadius: 8, boxShadow: '0 2px 8px #6366f155', zIndex: 2
        }} />
        {/* 아래쪽 패들 */}
        <div style={{
          position: 'absolute', left: paddles.bottom, bottom: 0,
          width: PW, height: PH, background: 'linear-gradient(90deg,#f59e42 60%,#fbbf24 100%)', borderRadius: 8, boxShadow: '0 2px 8px #f59e4255', zIndex: 2
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
        위쪽: <b>A/D</b> &nbsp;&nbsp; 아래쪽: <b>←/→</b>
      </div>
    </div>
  );
}
