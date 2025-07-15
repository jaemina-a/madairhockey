import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from "../socket";
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// 더미 데이터
// const leftUser = {
//   username: 'username1',
//   ready: true,
//   skills: [1, 2, 3, 4],
// };
// const rightUser = {
//   username: 'username2',
//   ready: true,
//   skills: [1, 2, 3, 4],
// };

export default function GameLoading() {
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1';
  const roomName = searchParams.get('room_name') || 'default';
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady_left, setIsReady_left] = useState(false);
  const [isReady_right, setIsReady_right] = useState(false);
  var isGameStartReady = false;
  const [leftUser, setLeftUser] = useState({name : "", skills : []});
  const [rightUser, setRightUser] = useState({name : "", skills : []});
  const navigate = useNavigate();
  useEffect(()=>{
    socket.on('join_loading_fail', (error)=>{
      console.log(error.error);
      console.log("join_loading_failed in client");
      //방 나가기
      navigate(`/mypage?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}`);
    });
    socket.on('join_loading_ready_toggle_success', (data)=>{
      console.log(data);
      if(data.side == "left"){
        setIsReady_left(data.ready);
      }else{
        setIsReady_right(data.ready);
      }
      if(isReady_left && isReady_right){
        isGameStartReady = true;
        console.log("leftUser.ready && rightUser.ready");
      }
      else{
        isGameStartReady = false;
      }
    });
    socket.on('join_loading_success', (data)=>{
      console.log(data);
      setLeftUser({name : data.left_username, skills : data.left_user_skills});
      setRightUser({name : data.right_username, skills : data.right_user_skills});
    });
    socket.emit("join_loading", {room_name: roomName, username: username});
  }, []);
  useEffect(()=>{
    if(leftUser.ready && rightUser.ready){
      console.log("leftUser.ready && rightUser.ready");
    }
  }, [leftUser.ready, rightUser.ready]);
  function readyToggle(side){
    socket.emit("join_loading_ready_toggle", {room_name: roomName, side: side});
  }
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg, #1e3a8a 0%, #38bdf8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      fontFamily: 'Press Start 2P, Pretendard, sans-serif',
      overflow: 'hidden',
    }}>
      {/* 중앙 VS */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        fontSize: 64, fontWeight: 900, color: '#fff', textShadow: '2px 2px 0 #000', zIndex: 2
      }}>
        VS
      </div>
      {/* 중앙 세로선 */}
      <div style={{
        position: 'absolute', left: '50%', top: '8%', height: '84%', width: 4,
        background: 'rgba(255,255,255,0.18)', borderRadius: 2, zIndex: 1
      }} />
      {/* 왼쪽 유저 */}
      <div style={{
        width: '48%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', textShadow: '2px 2px 0 #000', marginBottom: 12 }}>ready</div>
        <div style={{ fontSize: 22, color: '#fff', textShadow: '1px 1px 0 #000', marginBottom: 8 }}>{leftUser.name}</div>
        {/* 스킬 아이콘 대신 네모 박스 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {leftUser.skills.map((s, i) => (
            <div key={i} style={{ width: 54, height: 54, borderRadius: 8, background: '#ff9800', border: '3px solid #fff', boxShadow: '0 2px 8px #0003', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 24 }}>
              
            </div>
          ))}
        </div>
        {/* 준비 버튼 */}
        <button
          style={{
            marginTop: 24,
            background: isReady_left ? '#22c55e' : '#fff', // 준비 완료 시 초록색
            color: isReady_left ? '#fff' : '#2563eb',
            fontWeight: 700,
            border: 'none',
            borderRadius: 8,
            padding: '0.5em 1.2em',
            fontSize: 15,
            cursor: leftUser.name === username ? 'pointer' : 'not-allowed',
            boxShadow: isReady_left ? '0 2px 8px #22c55e55' : '0 1px 4px #0001',
            opacity: leftUser.name === username ? 1 : 0.5,
            transition: 'all 0.2s',
            outline: isReady_left ? '2px solid #22c55e' : 'none',
            letterSpacing: 1,
          }}
          disabled={leftUser.name !== username}
          onClick={() => {
            if (leftUser.name === username ) {
              readyToggle('left');
            }
          }}
        >{isReady_left ? '준비 완료 🎉' : '준비'}</button>
        {isReady_left && (
          <div style={{
            marginTop: 8,
            color: '#22c55e',
            fontWeight: 700,
            fontSize: 16,
            transition: 'color 0.2s',
          }}>
            준비 완료!
          </div>
        )}
      </div>
      {/* 오른쪽 유저 */}
      <div style={{
        width: '48%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', textShadow: '2px 2px 0 #000', marginBottom: 12 }}>ready</div>
        <div style={{ fontSize: 22, color: '#fff', textShadow: '1px 1px 0 #000', marginBottom: 8 }}>{rightUser.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {rightUser.skills.map((s, i) => (
            <div key={i} style={{ width: 54, height: 54, borderRadius: 8, background: '#ff9800', border: '3px solid #fff', boxShadow: '0 2px 8px #0003', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 24 }}>
              
            </div>
          ))}
        </div>
        {/* 준비 버튼 */}
        <button
          style={{
            marginTop: 24,
            background: isReady_right ? '#22c55e' : '#fff',
            color: isReady_right ? '#fff' : '#2563eb',
            fontWeight: 700,
            border: 'none',
            borderRadius: 8,
            padding: '0.5em 1.2em',
            fontSize: 15,
            cursor: rightUser.name === username ? 'pointer' : 'not-allowed',
            boxShadow: isReady_right ? '0 2px 8px #22c55e55' : '0 1px 4px #0001',
            opacity: rightUser.name === username ? 1 : 0.5,
            transition: 'all 0.2s',
            outline: isReady_right ? '2px solid #22c55e' : 'none',
            letterSpacing: 1,
          }}
          disabled={rightUser.name !== username}
          onClick={() => {
            if (rightUser.name === username) {
                readyToggle('right');
            }
          }}
        >{isReady_right ? '준비 완료 🎉' : '준비'}</button>
        {isReady_right && (
          <div style={{
            marginTop: 8,
            color: '#22c55e',
            fontWeight: 700,
            fontSize: 16,
            transition: 'color 0.2s',
          }}>
            준비 완료!
          </div>
        )}
      </div>
      {/* 바닥 그리드 효과 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '18%',
        background: 'linear-gradient(180deg, #38bdf8 0%, #1e3a8a 100%)',
        borderTop: '2px solid #fff2',
        zIndex: 0,
        opacity: 0.7
      }} />
      {/* 게임 시작 버튼 (UI만) */}
      <button
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '7%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg, #22c55e 0%, #38bdf8 100%)',
          color: '#fff',
          fontWeight: 900,
          fontSize: 24,
          border: 'none',
          borderRadius: 16,
          padding: '0.7em 2.5em',
          boxShadow: '0 4px 16px #0002',
          letterSpacing: 2,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => {
          if(isGameStartReady){
            console.log("game start");
            //navigate(`/game?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}`);
          }
        }}
        // onClick={() => { /* 추후 구현 */ }}
      >
        게임 시작
      </button>
    </div>
  );
}