import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function MyPage({ username }) {
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState({
    level: 15,
    exp: 1250,
    totalGames: 47,
    wins: 32,
    winRate: 68,
    currentStreak: 5,
    bestStreak: 12,
    totalPoints: 2840,
    rank: "골드"
  });

  const [achievements] = useState([
    { id: 1, name: "첫 승리", icon: "🏆", unlocked: true, description: "첫 번째 게임에서 승리" },
    { id: 2, name: "연승 마스터", icon: "🔥", unlocked: true, description: "10연승 달성" },
    { id: 3, name: "스피드 데몬", icon: "⚡", unlocked: false, description: "100km/h 이상의 공 속도 달성" },
    { id: 4, name: "완벽한 수비", icon: "🛡️", unlocked: false, description: "한 게임에서 실점 0개" },
    { id: 5, name: "올라운더", icon: "🌟", unlocked: true, description: "모든 스킨 수집" },
    { id: 6, name: "전설", icon: "👑", unlocked: false, description: "1000게임 플레이" }
  ]);

  const expToNextLevel = 2000;
  const expProgress = (userStats.exp / expToNextLevel) * 100;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2em 1em'
    }}>
      {/* 상단 프로필 카드 */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 24,
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        padding: '2.5em 2em',
        marginBottom: '2em',
        textAlign: 'center',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          margin: '0 auto 1em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2em',
          color: 'white',
          boxShadow: '0 8px 24px rgba(102,126,234,0.3)'
        }}>
          {username?.charAt(0).toUpperCase()}
        </div>
        
        <h2 style={{
          fontSize: '2.2em',
          fontWeight: 700,
          margin: '0 0 0.5em 0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {username}
        </h2>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1em',
          marginBottom: '1.5em'
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: 'white',
            padding: '0.5em 1em',
            borderRadius: 20,
            fontSize: '0.9em',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(251,191,36,0.3)'
          }}>
            {userStats.rank}
          </span>
          <span style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '0.5em 1em',
            borderRadius: 20,
            fontSize: '0.9em',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
          }}>
            Lv.{userStats.level}
          </span>
        </div>

        {/* 경험치 바 */}
        <div style={{ marginBottom: '2em' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5em',
            fontSize: '0.9em',
            color: '#666'
          }}>
            <span>경험치</span>
            <span>{userStats.exp} / {expToNextLevel}</span>
          </div>
          <div style={{
            width: '100%',
            height: 8,
            background: '#e5e7eb',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${expProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* 통계 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1em',
          marginBottom: '2em'
        }}>
          <StatCard title="총 게임" value={userStats.totalGames} icon="🎮" />
          <StatCard title="승률" value={`${userStats.winRate}%`} icon="📊" />
          <StatCard title="현재 연승" value={userStats.currentStreak} icon="🔥" />
          <StatCard title="최고 연승" value={userStats.bestStreak} icon="🏆" />
        </div>

        {/* 메인 버튼들 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
          <button
            onClick={() => navigate('/game')}
            style={buttonStyle('#6366f1', '#818cf8', '🏓 빠른 대전 찾기')}
          />
          <button
            onClick={() => navigate('/shop')}
            style={buttonStyle('#f59e42', '#fbbf24', '🛒 상점')}
          />
          <button
            onClick={() => navigate('/skin')}
            style={buttonStyle('#10b981', '#34d399', '🎨 스킨')}
          />
        </div>
      </div>

      {/* 업적 섹션 */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 24,
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        padding: '2em',
        backdropFilter: 'blur(10px)'
      }}>
        <h3 style={{
          fontSize: '1.5em',
          fontWeight: 600,
          margin: '0 0 1.5em 0',
          textAlign: 'center',
          color: '#374151'
        }}>
          🏆 업적
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1em'
        }}>
          {achievements.map(achievement => (
            <div key={achievement.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1em',
              background: achievement.unlocked 
                ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' 
                : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              borderRadius: 12,
              border: achievement.unlocked ? '2px solid #fbbf24' : '2px solid #d1d5db',
              opacity: achievement.unlocked ? 1 : 0.6,
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                fontSize: '2em',
                marginRight: '1em',
                filter: achievement.unlocked ? 'none' : 'grayscale(100%)'
              }}>
                {achievement.icon}
              </div>
              <div>
                <div style={{
                  fontWeight: 600,
                  color: achievement.unlocked ? '#92400e' : '#6b7280',
                  marginBottom: '0.25em'
                }}>
                  {achievement.name}
                </div>
                <div style={{
                  fontSize: '0.9em',
                  color: achievement.unlocked ? '#a16207' : '#9ca3af'
                }}>
                  {achievement.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '1em',
      borderRadius: 12,
      textAlign: 'center',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ fontSize: '1.5em', marginBottom: '0.5em' }}>{icon}</div>
      <div style={{ fontSize: '1.2em', fontWeight: 600, color: '#374151', marginBottom: '0.25em' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.9em', color: '#6b7280' }}>{title}</div>
    </div>
  );
}

function buttonStyle(color1, color2, children) {
  return {
    width: '100%',
    padding: '1em 0',
    fontSize: '1.1em',
    fontWeight: 600,
    border: 'none',
    borderRadius: 12,
    background: `linear-gradient(90deg, ${color1} 60%, ${color2} 100%)`,
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    transition: 'all 0.3s ease',
    outline: 'none',
    position: 'relative',
    overflow: 'hidden'
  };
} 