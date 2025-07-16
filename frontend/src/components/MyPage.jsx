import { useNavigate, useSearchParams } from 'react-router-dom';
import bgm from '../assets/audio/jpop.mp3';
import './MyPage.css';
import { useState, useRef } from 'react';
import socket from "../socket";
import { useEffect } from 'react';
import jpop from '../assets/audio/jpop.mp3';
import a from '../assets/audio/a.mp3';
import b from '../assets/audio/b.mp3';
import c from '../assets/audio/c.mp3';
import d from '../assets/audio/d.mp3';
import e from '../assets/audio/e.mp3';
import f from '../assets/audio/f.mp3';
import audioFry from '../assets/audio/audio_fry.mp3';
// 필요한 만큼 음악 파일 import (예시)

const musicList = [
  { src: jpop, title: 'LEGEND J-POP' },
  { src: a, title: 'LEGEND MUSIC' },
  { src: b, title: 'FRIENDSHIP' },
  { src: c, title: 'LOVE' }, 
  { src: d, title: 'HAPPINESS' },
  { src: e, title: 'SADNESS' },
  { src: f, title: '진짜좋은노래' },
  // { src: require('../assets/audio/다른음악.mp3'), title: '다른 곡' },
];

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1'; // 기본값 설정

  // UI 상태 관리 (로직 없음)
  const [roomName, setRoomName] = useState("default");
  const [roomList, setRoomList] = useState([
    
  ]);
  const [selectedTab, setSelectedTab] = useState('list');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef(null);

  useEffect(()=>{
    socket.on("room_updated", (roomList)=>{
      setRoomList(roomList);
    });
    socket.on("room_create_failed", (error)=>{
      console.log(error.error);
    });
  }, []);

  // 음악 재생/일시정지/볼륨/다음/이전
  const handlePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };
  const handlePrev = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTrack((prev) => (prev - 1 + musicList.length) % musicList.length);
    setIsPlaying(true);
  };
  const handleNext = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTrack((prev) => (prev + 1) % musicList.length);
    setIsPlaying(true);
  };
  const handleVolume = (e) => {
    setVolume(Number(e.target.value));
    if (audioRef.current) audioRef.current.volume = Number(e.target.value);
  };
  // 트랙 변경 시 자동 재생
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      if (isPlaying) audioRef.current.play();
    }
  }, [currentTrack]);
  // 볼륨 동기화
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);
  // 일시정지/재생 동기화
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.play();
      else audioRef.current.pause();
    }
  }, [isPlaying]);


  const updateRoomList = async ()=>{
    const response = await fetch(`${import.meta.env.VITE_SOCKET_URL}/api/get_room_list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    console.log(data);
    if(data.ok){
      console.log(data.rooms);
      setRoomList(data.rooms);
    }else{
      console.error(data.error);
    }
  }
  const handleGameStart = (roomName) => {
    navigate(`/game?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}`);
  };
  const handleGameLoad = (roomName) => {
    navigate(`/load_game?username=${encodeURIComponent(username)}&room_name=${encodeURIComponent(roomName)}`);
  }

  const makeRoom = (roomName)=>{
    if(roomName == ""){
      roomName = username + "의 방";
    }
    console.log("makeRoom in client, roomName : ", roomName);
    socket.emit("room_create", {username: username, room_name: roomName});
  }

  return (
    <div>
      
      <div style={{
  position: 'fixed',
  top: 14,
  right: 14,
  zIndex: 999,
  background: 'rgba(255,255,255,0.9)',
  borderRadius: 10,
  boxShadow: '0 1px 6px #0002',
  padding: '0.6em 1em',
  minWidth: 200,
  minHeight: 60,
  color: '#222',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #e0e7ef',
  fontFamily: 'Pretendard, sans-serif',
  userSelect: 'none',
  boxSizing: 'border-box',
  gap: 4,
}}>
  {/* Title */}
  <div style={{
    fontWeight: 600,
    fontSize: 12,
    color: '#2563eb',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  }}>
    {musicList[currentTrack].title}
  </div>

  {/* Buttons */}
  <div style={{
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  }}>
    <button onClick={handlePrev} style={mp3SimpleBtnStyle}>{'⏮️'}</button>
    <button onClick={handlePlayPause} style={mp3SimpleBtnStyle}>{isPlaying ? '⏸️' : '▶️'}</button>
    <button onClick={handleNext} style={mp3SimpleBtnStyle}>{'⏭️'}</button>
  </div>

  {/* Volume */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  }}>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={volume}
      onChange={handleVolume}
      style={{
        width: '100%',
        height: 6,
        accentColor: '#2563eb',
        background: '#e0e7ef',
        borderRadius: 4,
      }}
    />
  </div>

  {/* Audio */}
  <audio
    ref={audioRef}
    src={musicList[currentTrack].src}
    autoPlay
    loop
    style={{ display: 'none' }}
  />
</div>

    <div style={{
      minHeight: '100vh',
      minWidth: '100vw',
      height: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #60a5fa 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      fontFamily: 'Pretendard, sans-serif',
      padding: '0',
      position: 'relative',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* 상단 탭/버튼 */}
      <div style={{ display: 'flex', gap: 16, marginTop: 32, marginBottom: 12 }}>
        <button
          style={{
            background: selectedTab === 'quick' ? 'linear-gradient(180deg, #fbbf24 0%, #f59e42 100%)' : '#fbbf24',
            color: '#fff', fontWeight: 700, fontSize: 20, border: 'none', borderRadius: 12,
            boxShadow: '0 2px 8px #0003', padding: '0.7em 2.2em', cursor: 'pointer',
            outline: selectedTab === 'quick' ? '3px solid #f59e42' : 'none',
            opacity: selectedTab === 'quick' ? 1 : 0.7
          }}
          onClick={() => {
            setSelectedTab('quick');
            handleGameStart(roomName);
          }}
        >빠른시작</button>
      </div>

      {/* 하위 버튼/탭 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
        <button 
          style={subBtnStyle}
          onClick={() => {makeRoom(roomName)}}>
            방만들기
        </button>
        <button style={subBtnStyle} onClick={updateRoomList}>방 업데이트</button>
      </div>

      {/* 방 리스트 카드 영역 */}
      <div style={{
        background: 'rgba(255,255,255,0.10)',
        borderRadius: 18,
        boxShadow: '0 4px 24px #0002',
        padding: '2em 2.5em',
        minWidth: 600,
        minHeight: 420,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 18,
        marginBottom: 24
      }}>
        {roomList.map(room => (
          <div key={room.id} style={{
            background: room.is_playing ? 'linear-gradient(90deg, #38bdf8 60%, #2563eb 100%)' : 'linear-gradient(90deg, #fbbf24 60%, #f59e42 100%)',
            borderRadius: 14,
            boxShadow: '0 2px 12px #0002',
            padding: '1.2em 1.5em',
            display: 'flex', flexDirection: 'column', gap: 8,
            border: selectedRoom === room.id ? '3px solid #fff' : '2px solid #2563eb',
            position: 'relative',
            minHeight: 110
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 48, height: 48, background: '#222', borderRadius: 8, marginRight: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28 }}>
                🏴‍☠️
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#fff', textShadow: '1px 1px 0 #0008' }}>{room.room_name}</div>
                <div style={{ fontSize: 14, color: '#e0e7ff', marginTop: 2 }}>상태: {room.is_playing ? "PLAYING" : "WAITING"}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 16, background: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: '0.3em 0.8em' }}>{room.current_player}/{room.max_player}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button style={{
                background: '#fff', color: '#2563eb', fontWeight: 700, border: 'none', borderRadius: 8,
                padding: '0.5em 1.2em', fontSize: 15, cursor: 'pointer', boxShadow: '0 1px 4px #0001'
              }}
              onClick={() => {
                console.log(room.room_name);
                handleGameLoad(room.room_name);
              }}
              disabled={room.is_playing}
              >{room.is_playing ? "입장 불가" : "입장"}</button>
              <span style={{ color: '#fff', fontSize: 13, marginLeft: 8 }}>ID: {room.id}</span>
            </div>
            {room.is_playing && (
              <div style={{
                position: 'absolute', top: 10, right: 18, background: '#fff', color: '#38bdf8', fontWeight: 700,
                borderRadius: 8, padding: '0.2em 0.8em', fontSize: 13, boxShadow: '0 1px 4px #0001'
              }}>PLAYING</div>
            )}
          </div>
        ))}
        {/* 빈 방 카드 (최대 6개까지 표시) */}
        {Array.from({ length: 6 - roomList.length }).map((_, i) => (
          <div key={i} style={{
            background: 'linear-gradient(90deg, #e0e7ff 60%, #c7d2fe 100%)',
            borderRadius: 14,
            boxShadow: '0 2px 12px #0001',
            minHeight: 110,
            border: '2px dashed #94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 600
          }}>
            빈 방
          </div>
        ))}
      </div>

      {/* 하단 페이지네이션 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 32 }}>
        <button style={pageBtnStyle}>{'<'}</button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, padding: '0 12px' }}>1 / 3</span>
        <button style={pageBtnStyle}>{'>'}</button>
      </div>
    </div>
    </div>
  );
}

const subBtnStyle = {
  background: 'linear-gradient(180deg, #38bdf8 0%, #2563eb 100%)',
  color: '#fff', fontWeight: 600, fontSize: 15, border: 'none', borderRadius: 10,
  boxShadow: '0 1px 4px #0002', padding: '0.5em 1.5em', cursor: 'pointer',
  outline: 'none', opacity: 0.95
};

const pageBtnStyle = {
  background: 'linear-gradient(180deg, #38bdf8 0%, #2563eb 100%)',
  color: '#fff', fontWeight: 700, fontSize: 18, border: 'none', borderRadius: 8,
  boxShadow: '0 1px 4px #0002', padding: '0.4em 1.2em', cursor: 'pointer',
  outline: 'none', opacity: 0.95
}; 

const mp3SimpleBtnStyle = {
  background: 'none',
  color: '#2563eb', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: '50%',
  boxShadow: 'none', width: 20, height: 20, cursor: 'pointer',
  outline: 'none', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.2s, color 0.2s',
  padding: 0,
}; 