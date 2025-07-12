import titleBg from '../assets/title_bg.png';
import btnGameStart from '../assets/btn_gamestart.png';
import shopImg from '../assets/shop.png';
import './MyPage.css';

export default function MyPage() {
  return (
    <div className="mypage-bg">
      <img className="mypage-shop-btn" src={shopImg} alt="shop" />
      <img className="mypage-gamestart-btn" src={btnGameStart} alt="game start" />
    </div>
  );
} 