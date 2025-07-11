import { useNavigate } from "react-router-dom";

export default function ShopPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #a7bfe8 100%)'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(80,100,180,0.12)',
        padding: '2.5em 2em',
        minWidth: 320,
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: '2em',
          fontWeight: 700,
          margin: 0,
          background: 'linear-gradient(135deg, #f59e42 0%, #fbbf24 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          상점
        </h2>
        <div style={{ color: '#555', margin: '1.5em 0', fontSize: '1.1em' }}>
          상점 기능은 곧 추가될 예정입니다.<br/>조금만 기다려 주세요!
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '0.7em 2em',
            fontSize: '1em',
            fontWeight: 600,
            border: 'none',
            borderRadius: 10,
            background: 'linear-gradient(90deg, #6366f1 60%, #818cf8 100%)',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(80,100,180,0.10)',
            marginTop: 16
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
} 