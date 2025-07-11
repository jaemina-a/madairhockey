import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const W = 800, H = 401, PW = 10, PH = 80, BR = 10;

export default function GameBoard() {
  const [state, setState] = useState(null);
  const [side, setSide] = useState(null);
  const room = "default";
  const socketRef = useRef(null);

  useEffect(() => {
    // 소켓 새로 생성
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
      let dy = 0;
      if (side === "left") {
        if (e.key === "w") dy = -10;
        if (e.key === "s") dy = +10;
      } else if (side === "right") {
        if (e.key === "ArrowUp") dy = -10;
        if (e.key === "ArrowDown") dy = +10;
      }
      if (dy && side && socketRef.current) socketRef.current.emit("paddle_move", { room, side, dy });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [side]);

  if (!state) return <p>대전 상대를 기다리는 중…</p>;
  const { ball, paddles, scores } = state;

  let sideLabel = '';
  if (side === 'left') sideLabel = '당신은 왼쪽입니다 (W/S)';
  else if (side === 'right') sideLabel = '당신은 오른쪽입니다 (↑/↓)';
  else if (side === null) sideLabel = '';

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{sideLabel}</div>
      <h2>{scores.left} : {scores.right}</h2>
      <div style={{
        position: "relative", width: W, height: H, margin: "0 auto",
        border: "2px solid #000", background: "#0f0"
      }}>
        {/* 왼쪽 패들 */}
        <div style={{
          position: "absolute", left: 0, top: paddles.left,
          width: PW, height: PH, background: "#fff"
        }} />
        {/* 오른쪽 패들 */}
        <div style={{
          position: "absolute", right: 0, top: paddles.right,
          width: PW, height: PH, background: "#fff"
        }} />
        {/* 공 */}
        <div style={{
          position: "absolute", left: ball.x - BR, top: ball.y - BR,
          width: BR*2, height: BR*2, borderRadius: "50%", background: "red"
        }} />
      </div>
    </div>
  );
}
