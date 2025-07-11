import { useNavigate } from "react-router-dom";

export default function MyPage({ username }) {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #a7bfe8 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 24,
        boxShadow: '0 8px 32px rgba(80,100,180,0.12)',
        padding: '2.5em 2em 2em 2em',
        minWidth: 320,
        textAlign: 'center',
        marginBottom: 32
      }}>
        <h2 style={{
          fontSize: '2.1em',
          fontWeight: 700,
          margin: 0,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          마이페이지
        </h2>
        <div style={{ color: '#555', margin: '1em 0 2em 0', fontSize: '1.1em' }}>
          안녕하세요, <b>{username}</b>님!
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2em' }}>
          <button
            onClick={() => navigate('/game')}
            style={buttonStyle('#6366f1', '#818cf8')}
          >
            🏓 빠른 대전 찾기
          </button>
          <button
            onClick={() => navigate('/shop')}
            style={buttonStyle('#f59e42', '#fbbf24')}
          >
            🛒 상점
          </button>
          <button
            onClick={() => navigate('/skin')}
            style={buttonStyle('#10b981', '#34d399')}
          >
            🎨 스킨
          </button>
        </div>
      </div>
    </div>
  );
}

function buttonStyle(color1, color2) {
  return {
    width: 220,
    padding: '0.9em 0',
    fontSize: '1.15em',
    fontWeight: 600,
    border: 'none',
    borderRadius: 12,
    background: `linear-gradient(90deg, ${color1} 60%, ${color2} 100%)`,
    color: 'white',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(80,100,180,0.10)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    outline: 'none',
    margin: '0 auto',
  };
} 