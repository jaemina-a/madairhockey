import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from "../socket";
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jaeminChar from '../assets/character/jaemin_char.png';
import bongChar from '../assets/character/bong_char.png';
import sonChar from '../assets/character/son_char.png';
import jparkChar from '../assets/character/jpark_char.png';
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

// 유틸: 6개를 2개씩 3줄로 나누는 함수
function chunkSkills(skills) {
  return [skills.slice(0,2), skills.slice(2,4), skills.slice(4,6)];
}

export default function GameLoading() {
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1';
  const roomName = searchParams.get('room_name') || 'default';
  const [mySide, setMySide] = useState(null);
  const mySideRef = useRef(null);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady_left, setIsReady_left] = useState(false);
  const [isReady_right, setIsReady_right] = useState(false);
  const [isGameStartReady, setIsGameStartReady] = useState(false); // React 상태로 변경
  const [leftUser, setLeftUser] = useState({name : "", skills : []});
  const [rightUser, setRightUser] = useState({name : "", skills : []});
  const navigate = useNavigate();
  // 캐릭터 이미지 배열
  const characterImages = [
    { src: jaeminChar, name: 'jaemin' },
    { src: bongChar, name: 'bong' },
    { src: sonChar, name: 'son' },
    { src: jparkChar, name: 'jpark' },
  ];
  // 왼쪽/오른쪽 캐릭터 인덱스 각각 관리
  const [leftCharIndex, setLeftCharIndex] = useState(0);
  const [rightCharIndex, setRightCharIndex] = useState(0);

  // 캐릭터 변경 시 서버에 emit
  const handlePrevChar = (side) => {
    if (side === 'left') {
      const newIndex = (leftCharIndex - 1 + characterImages.length) % characterImages.length;
      setLeftCharIndex(newIndex);
      socket.emit('character_select', { room_name: roomName, side: 'left', character_index: newIndex });
    } else {
      const newIndex = (rightCharIndex - 1 + characterImages.length) % characterImages.length;
      setRightCharIndex(newIndex);
      socket.emit('character_select', { room_name: roomName, side: 'right', character_index: newIndex });
    }
  };
  const handleNextChar = (side) => {
    if (side === 'left') {
      const newIndex = (leftCharIndex + 1) % characterImages.length;
      setLeftCharIndex(newIndex);
      socket.emit('character_select', { room_name: roomName, side: 'left', character_index: newIndex });
    } else {
      const newIndex = (rightCharIndex + 1) % characterImages.length;
      setRightCharIndex(newIndex);
      socket.emit('character_select', { room_name: roomName, side: 'right', character_index: newIndex });
    }
  };

  useEffect(()=>{
    mySideRef.current = mySide;
  }, [mySide]);
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
    });
    socket.on('join_loading_success', (data)=>{
      console.log(data);
      console.log("join_loading_success in client, myside: ", data.side);
      if(mySideRef.current == null){
        console.log("mySide is null, set mySide to : ", data.side);
        setMySide(data.side);
      }
      setLeftUser({name : data.left_username || "waiting", skills : data.left_user_skills || []});
      setRightUser({name : data.right_username || "waiting", skills : data.right_user_skills || [] });
    });
    socket.on('loading_room_updated', (data)=>{
      console.log("loading_room_updated in client", data);
      const game = data.loading_game;
      setLeftUser({name : game.left_username, skills : game.left_user_skills});
      setRightUser({name : game.right_username, skills : game.right_user_skills});
      // 캐릭터 인덱스 동기화
      if (typeof game.left_character === 'number') setLeftCharIndex(game.left_character);
      if (typeof game.right_character === 'number') setRightCharIndex(game.right_character);
    });
    socket.on('leave_loading_success', (data)=>{
      console.log("leave_loading_success in client", data);
      console.log("mySide : ", mySideRef.current);
      console.log("data.side : ", data.side);
      if(data.side == mySideRef.current){
        navigate(`/mypage?username=${encodeURIComponent(username)}`);
      }
    });
    // 서버에서 게임 시작 신호 받기
    socket.on('game_start_ready', (data)=>{
      console.log("서버에서 게임 시작 신호 받음!", data);
      setIsGameStartReady(true);
      // 2초 후 게임 시작
      setTimeout(() => {
        console.log("게임 시작 버튼 클릭! room_name : ", roomName, "username : ", username);
        // navigate(`/game?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}`);
      }, 2000);
    });
    socket.emit("join_loading", {room_name: roomName, username: username});
  }, []);
  
  // 두 명이 모두 준비되면 자동으로 게임 시작
  useEffect(()=>{
    if(isReady_left && isReady_right){
      console.log("두 명이 모두 준비됨! 게임 시작!");
      setIsGameStartReady(true);
      // 자동으로 게임 시작
      setTimeout(() => {
        handleGameStart()
        // navigate(`/game?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}`);
      }, 1000); // 1초 후 게임 시작
    } else {
      setIsGameStartReady(false);
    }
  }, [isReady_left, isReady_right, username, roomName, navigate]);
  
  function readyToggle(side){
    socket.emit("join_loading_ready_toggle", {room_name: roomName, side: side});
  }
  
  // 게임 시작 버튼 클릭 핸들러
  const handleGameStart = () => {
    if(isGameStartReady){
      console.log("게임 시작 버튼 클릭!");
      if(mySide == "left"){
        navigate(`/game?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}&character_id=${encodeURIComponent(leftCharIndex)}`);
      }else{
        navigate(`/game?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}&character_id=${encodeURIComponent(rightCharIndex)}`);
      }
    }
  };

  // 현재 인원 계산 (waiting이 아닌 유저 수)
  const currentCount = [leftUser, rightUser].filter(u => u.name && u.name !== 'waiting').length;
  const maxCount = 2;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg, #1e3a8a 0%, #38bdf8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      fontFamily: 'Press Start 2P, Pretendard, sans-serif',
      overflow: 'hidden',
    }}>
      {/* 중앙 상단 방 정보 표시 */}
      <div style={{
        position: 'absolute',
        top: '2.2vh',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(30,58,138,0.97)',
        borderRadius: 18,
        boxShadow: '0 4px 24px #38bdf855, 0 1.5px 0 #fff',
        padding: '0.7em 3.5em 0.7em 3.5em',
        color: '#fff',
        fontWeight: 900,
        fontSize: 26,
        letterSpacing: 2,
        zIndex: 100,
        border: '2.5px solid #38bdf8',
        textAlign: 'center',
        textShadow: '0 2px 12px #38bdf8, 0 1px 0 #0ea5e9',
        filter: 'drop-shadow(0 0 8px #bae6fd)',
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 32,
        minWidth: 420,
        minHeight: 56,
        maxWidth: '70vw',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none', // 클릭 방지
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#bae6fd', marginRight: 18, letterSpacing: 1, whiteSpace: 'nowrap' }}>방 이름</span>
        <span style={{ fontSize: 30, fontWeight: 900, color: '#fff', textShadow: '0 2px 12px #38bdf8', maxWidth: 400, textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{roomName}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#bae6fd', margin: '0 18px', whiteSpace: 'nowrap' }}>|</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#bae6fd', marginRight: 10, whiteSpace: 'nowrap' }}>인원</span>
        <span style={{ fontSize: 30, fontWeight: 900, color: '#fff', textShadow: '0 2px 12px #38bdf8', whiteSpace: 'nowrap' }}>{currentCount} / {maxCount}</span>
      </div>
      {/* 중앙 캐릭터 선택 캐러셀 */}
      {/* 중앙 캐릭터 캐러셀 관련 코드(변수, 렌더링 등) 완전히 삭제 */}
      {/* 왼쪽/오른쪽 유저 영역에만 아래 캐릭터 캐러셀 남김 */}
      {/* (이미 적용되어 있음) */}
      {/* 캐릭터 이름 표시 */}
      <div style={{
        position: 'absolute', left: '50%', top: '48%', transform: 'translate(-50%, 0)',
        color: '#fff', fontWeight: 700, fontSize: 22, textAlign: 'center',
        textShadow: '1px 1px 8px #000a', letterSpacing: 2, zIndex: 10
      }}>
        {/* 중앙 캐릭터 캐러셀 부분(예: <div style={{ position: 'absolute', ... }}> ... ) 전체 삭제 */}
      </div>
      {/* 중앙 VS */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        fontSize: 80, fontWeight: 700, color: '#38bdf8', textShadow: '0 4px 24px #bae6fd, 0 2px 0 #fff', zIndex: 2,
        letterSpacing: 8,
        fontFamily: 'Pretendard, Press Start 2P, sans-serif',
        filter: 'drop-shadow(0 0 8px #bae6fd)',
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
        width: '48%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        position: 'relative',
      }}>

        {/* 유저 이름 (캐릭터 위, 세련된 스타일) */}
        {leftUser.name !== 'waiting' && (
          <div style={{
            fontSize: 48, fontWeight: 700, color: '#fff',
            textShadow: '0 2px 12px #38bdf8, 0 1px 0 #0ea5e9',
            marginTop: 36, marginBottom: 100, letterSpacing: 1.5,
            fontFamily: 'Pretendard, Press Start 2P, sans-serif',
            position: 'relative', zIndex: 2,
            filter: 'drop-shadow(0 0 4px #bae6fd)',
            textAlign: 'center',
            borderRadius: 12,
          }}>{leftUser.name}</div>
        )}
        {/* 캐릭터 캐러셀: 원형 화살표, 부드러운 그림자, 라운드 이미지 */}
        {leftUser.name !== 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 0 0 0', height: 'min(38vw, 360px)' }}>
            {/* 캐릭터 이미지 */}
            <img
              src={characterImages[leftCharIndex].src}
              alt={characterImages[leftCharIndex].name}
              style={{
                width: 220, height: 220, objectFit: 'contain', borderRadius: 32,
                border: 'none',
                margin: '0 18px',
                imageRendering: 'pixelated',
                zIndex: 1,
              }}
            />
            {/* 캐릭터 선택 버튼 (아래로) */}
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'min(2vw, 12px)', gap: 'min(4vw, 32px)' }}>
              <button
                onClick={() => handlePrevChar('left')}
                style={{
                  fontSize: 'min(7vw, 36px)', fontWeight: 900, color: '#38bdf8', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer',
                  padding: 0, userSelect: 'none',
                  borderRadius: '50%', boxShadow: '0 2px 12px #bae6fd',
                  height: 'min(11vw, 56px)', width: 'min(11vw, 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s',
                  outline: 'none',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#e0f2fe'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
              >
                {'<'}
              </button>
              <button
                onClick={() => handleNextChar('left')}
                style={{
                  fontSize: 'min(7vw, 36px)', fontWeight: 900, color: '#38bdf8', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer',
                  padding: 0, userSelect: 'none',
                  borderRadius: '50%', boxShadow: '0 2px 12px #bae6fd',
                  height: 'min(11vw, 56px)', width: 'min(11vw, 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s',
                  outline: 'none',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#e0f2fe'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
              >
                {'>'}
              </button>

            </div>
            {/* 스킬 아이콘: 캐릭터 아래 3x2 그리드, 세련된 스타일 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, min(12vw, 60px))',
              gridTemplateRows: 'repeat(2, min(12vw, 60px))',
              gap: 'min(2.8vw, 14px)',
              marginTop: 'min(5vw, 28px)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {[...Array(6)].map((_, i) => (
                leftUser.skills[i] ? (
                  <div key={i} style={{ width: 'min(12vw, 60px)', height: 'min(12vw, 60px)', borderRadius: 16, background: 'linear-gradient(135deg,#fbbf24 60%,#f59e42 100%)', border: '2px solid #bae6fd', boxShadow: '0 2px 8px #bae6fd88', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 'min(5vw, 28px)' }}>
                    <span role="img" aria-label="skill">🔥</span>
                  </div>
                ) : (
                  <div key={i} style={{ width: 'min(12vw, 60px)', height: 'min(12vw, 60px)', borderRadius: 16, background: 'rgba(255,255,255,0.12)', border: '2px solid #e0e7ef' }} />
                )
              ))}
            </div>
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
        )}
      </div>
      {/* 오른쪽 유저 */}
      <div style={{
        width: '48%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        position: 'relative',
      }}>
        {/* 유저 이름 (캐릭터 위, 세련된 스타일) */}
        {rightUser.name !== 'waiting' && (

          <div style={{
            fontSize: 48, fontWeight: 700, color: '#fff',
            textShadow: '0 2px 12px #38bdf8, 0 1px 0 #0ea5e9',
            marginTop: 36, marginBottom: 100, letterSpacing: 1.5,
            fontFamily: 'Pretendard, Press Start 2P, sans-serif',
            position: 'relative', zIndex: 2,
            filter: 'drop-shadow(0 0 4px #bae6fd)',
            textAlign: 'center',
            borderRadius: 12,
          }}>{rightUser.name}</div>
        )}
        {/* 캐릭터 캐러셀: 원형 화살표, 부드러운 그림자, 라운드 이미지 */}
        {rightUser.name !== 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 0 0 0', height: 'min(38vw, 360px)' }}>
            {/* 캐릭터 이미지 */}
            <img
              src={characterImages[rightCharIndex].src}
              alt={characterImages[rightCharIndex].name}
              style={{
                width: 220, height: 220, objectFit: 'contain', borderRadius: 32,
                border: 'none',
                margin: '0 18px',
                imageRendering: 'pixelated',
                zIndex: 1,
              }}
            />
            {/* 캐릭터 선택 버튼 (아래로) */}
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'min(2vw, 12px)', gap: 'min(4vw, 32px)' }}>
              <button
                onClick={() => handlePrevChar('right')}
                style={{
                  fontSize: 'min(7vw, 36px)', fontWeight: 900, color: '#38bdf8', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer',
                  padding: 0, userSelect: 'none',
                  borderRadius: '50%', boxShadow: '0 2px 12px #bae6fd',
                  height: 'min(11vw, 56px)', width: 'min(11vw, 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s',
                  outline: 'none',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#e0f2fe'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
              >
                {'<'}
              </button>
              <button
                onClick={() => handleNextChar('right')}
                style={{
                  fontSize: 'min(7vw, 36px)', fontWeight: 900, color: '#38bdf8', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer',
                  padding: 0, userSelect: 'none',
                  borderRadius: '50%', boxShadow: '0 2px 12px #bae6fd',
                  height: 'min(11vw, 56px)', width: 'min(11vw, 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, color 0.2s',
                  outline: 'none',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#e0f2fe'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
              >
                {'>'}
              </button>
            </div>
            {/* 스킬 아이콘: 캐릭터 아래 3x2 그리드, 세련된 스타일 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, min(12vw, 60px))',
              gridTemplateRows: 'repeat(2, min(12vw, 60px))',
              gap: 'min(2.8vw, 14px)',
              marginTop: 'min(5vw, 28px)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {[...Array(6)].map((_, i) => (
                rightUser.skills[i] ? (
                  <div key={i} style={{ width: 'min(12vw, 60px)', height: 'min(12vw, 60px)', borderRadius: 16, background: 'linear-gradient(135deg,#fbbf24 60%,#f59e42 100%)', border: '2px solid #bae6fd', boxShadow: '0 2px 8px #bae6fd88', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 'min(5vw, 28px)' }}>
                    <span role="img" aria-label="skill">🔥</span>
                  </div>
                ) : (
                  <div key={i} style={{ width: 'min(12vw, 60px)', height: 'min(12vw, 60px)', borderRadius: 16, background: 'rgba(255,255,255,0.12)', border: '2px solid #e0e7ef' }} />
                )
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
      {/* 게임 시작 버튼 */}
      <button
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '7%',
          transform: 'translateX(-50%)',
          background: isGameStartReady ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(90deg, #6b7280 0%, #4b5563 100%)',
          color: '#fff',
          fontWeight: 900,
          fontSize: 24,
          border: 'none',
          borderRadius: 16,
          padding: '0.7em 2.5em',
          boxShadow: isGameStartReady ? '0 4px 16px #22c55e55' : '0 4px 16px #0002',
          letterSpacing: 2,
          cursor: isGameStartReady ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          opacity: isGameStartReady ? 1 : 0.6,
        }}
        onClick={handleGameStart}
        disabled={!isGameStartReady}
      >
        {isGameStartReady ? '게임 시작!' : '준비 대기중...'}
      </button>
      <button
        style={{
          position: 'absolute',
          right: '3vw',
          bottom: '3vh',
          background: '#ef4444',
          color: '#fff',
          fontWeight: 700,
          fontSize: 18,
          border: 'none',
          borderRadius: 12,
          padding: '0.6em 2em',
          boxShadow: '0 2px 8px #ef444455',
          letterSpacing: 1,
          cursor: 'pointer',
          opacity: 0.92,
          zIndex: 10
        }}
        onClick={() => { 
            socket.emit("leave_loading", {room_name: roomName, username: username, side: mySide});
         }}
      >
        나가기
      </button>
    </div>
  );
}