import { useNavigate, useSearchParams } from 'react-router-dom';
import titleBg from '../assets/title_bg.png';
import btnGameStart from '../assets/btn_gamestart.png';
import shopImg from '../assets/shop.png';
import './MyPage.css';

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('username') || 'player1'; // 기본값 설정

  const handleGameStart = () => {
    navigate(`/game?username=${encodeURIComponent(username)}`);
  };

  return (
    <div className="mypage-bg">
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '20px',
        fontSize: '14px'
      }}>
        👤 {username}
      </div>
      <img className="mypage-shop-btn" src={shopImg} alt="shop" />
      <img 
        className="mypage-gamestart-btn" 
        src={btnGameStart} 
        alt="game start" 
        onClick={handleGameStart}
        style={{ cursor: 'pointer' }}
      />
    </div>
  );
} 