import { useNavigate, useSearchParams } from 'react-router-dom';
import titleBg from '../assets/title_bg.png';
import btnGameStart from '../assets/btn_gamestart.png';
import shopImg from '../assets/shop.png';
import './MyPage.css';
import { useState } from 'react';

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1'; // 기본값 설정

  // UI 상태 관리 (로직 없음)
  const [roomName, setRoomName] = useState("");
  const [roomList] = useState([
    { id: 1, name: "해적선의 비밀", status: "PLAYING", players: 8, max: 8 },
    { id: 2, name: "초보 연습방", status: "WAITING", players: 2, max: 8 },
    { id: 3, name: "고수만!", status: "WAITING", players: 1, max: 8 },
  ]);
  const [selectedTab, setSelectedTab] = useState('list');
  const [selectedRoom, setSelectedRoom] = useState(null);

  const handleGameStart = () => {
    navigate(`/game?username=${encodeURIComponent(username)}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #60a5fa 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      fontFamily: 'Pretendard, sans-serif',
      padding: '0',
      position: 'relative'
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
            handleGameStart();
          }}
        >빠른시작</button>
        <button
          style={{
            background: selectedTab === 'crazy' ? 'linear-gradient(180deg, #a78bfa 0%, #6366f1 100%)' : '#a78bfa',
            color: '#fff', fontWeight: 700, fontSize: 20, border: 'none', borderRadius: 12,
            boxShadow: '0 2px 8px #0003', padding: '0.7em 2.2em', cursor: 'pointer',
            outline: selectedTab === 'crazy' ? '3px solid #6366f1' : 'none',
            opacity: selectedTab === 'crazy' ? 1 : 0.7
          }}
          onClick={() => setSelectedTab('crazy')}
        >크아짱</button>
        <button
          style={{
            background: selectedTab === 'list' ? 'linear-gradient(180deg, #38bdf8 0%, #2563eb 100%)' : '#38bdf8',
            color: '#fff', fontWeight: 700, fontSize: 20, border: 'none', borderRadius: 12,
            boxShadow: '0 2px 8px #0003', padding: '0.7em 2.2em', cursor: 'pointer',
            outline: selectedTab === 'list' ? '3px solid #2563eb' : 'none',
            opacity: selectedTab === 'list' ? 1 : 0.7
          }}
          onClick={() => setSelectedTab('list')}
        >방리스트</button>
      </div>

      {/* 하위 버튼/탭 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <button style={subBtnStyle}>방만들기</button>
        <button style={subBtnStyle}>대기방입장</button>
        <button style={{ ...subBtnStyle, background: '#38bdf8', color: '#fff' }}>?</button>
        <button style={subBtnStyle}>모든방보기</button>
        <button style={subBtnStyle}>혼자놀기</button>
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
            background: room.status === 'PLAYING' ? 'linear-gradient(90deg, #38bdf8 60%, #2563eb 100%)' : 'linear-gradient(90deg, #fbbf24 60%, #f59e42 100%)',
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
                <div style={{ fontWeight: 700, fontSize: 18, color: '#fff', textShadow: '1px 1px 0 #0008' }}>{room.name}</div>
                <div style={{ fontSize: 14, color: '#e0e7ff', marginTop: 2 }}>상태: {room.status}</div>
              </div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 16, background: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: '0.3em 0.8em' }}>{room.players}/{room.max}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button style={{
                background: '#fff', color: '#2563eb', fontWeight: 700, border: 'none', borderRadius: 8,
                padding: '0.5em 1.2em', fontSize: 15, cursor: 'pointer', boxShadow: '0 1px 4px #0001'
              }}>입장</button>
              <span style={{ color: '#fff', fontSize: 13, marginLeft: 8 }}>ID: {room.id}</span>
            </div>
            {room.status === 'PLAYING' && (
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