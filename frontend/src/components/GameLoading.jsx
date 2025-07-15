import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// 더미 데이터
const leftUser = {
  username: 'username1',
  ready: true,
  skills: [1, 2, 3, 4],
};
const rightUser = {
  username: 'username2',
  ready: true,
  skills: [1, 2, 3, 4],
};

export default function GameLoading() {
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1';
  const roomName = searchParams.get('room_name') || 'default';

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
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
        <div style={{ fontSize: 22, color: '#fff', textShadow: '1px 1px 0 #000', marginBottom: 8 }}>{leftUser.username}</div>
        {/* 스킬 아이콘 대신 네모 박스 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {leftUser.skills.map((s, i) => (
            <div key={i} style={{ width: 54, height: 54, borderRadius: 8, background: '#ff9800', border: '3px solid #fff', boxShadow: '0 2px 8px #0003', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 24 }}>
              {/* 아이콘 대신 숫자 */}
              {s}
            </div>
          ))}
        </div>
      </div>
      {/* 오른쪽 유저 */}
      <div style={{
        width: '48%', height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', textShadow: '2px 2px 0 #000', marginBottom: 12 }}>ready</div>
        <div style={{ fontSize: 22, color: '#fff', textShadow: '1px 1px 0 #000', marginBottom: 8 }}>{rightUser.username}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {rightUser.skills.map((s, i) => (
            <div key={i} style={{ width: 54, height: 54, borderRadius: 8, background: '#ff9800', border: '3px solid #fff', boxShadow: '0 2px 8px #0003', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 24 }}>
              {s}
            </div>
          ))}
        </div>
      </div>
      {/* 바닥 그리드 효과 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '18%',
        background: 'linear-gradient(180deg, #38bdf8 0%, #1e3a8a 100%)',
        borderTop: '2px solid #fff2',
        zIndex: 0,
        opacity: 0.7
      }} />
    </div>
  );
}