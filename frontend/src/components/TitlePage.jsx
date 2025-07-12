import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import titleBg from '../assets/title_bg.png';
import titleImg from '../assets/title.png';
import btnLoginImg from '../assets/btn_login.png';
import btnSignupImg from '../assets/btn_signup.png';
import './TitlePage.css';

export default function TitlePage() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [signupId, setSignupId] = useState("");
  const [signupPw, setSignupPw] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [signupMsg, setSignupMsg] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoginMsg("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginId, password: loginPw })
      });
      if (res.ok) {
        setLoginMsg("");
        navigate("/mypage");
      } else {
        setLoginMsg("없는 회원입니다");
      }
    } catch (e) {
      setLoginMsg("서버 오류");
    }
  };

  const handleSignup = async () => {
    setSignupMsg("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: signupId, password: signupPw })
      });
      if (res.ok) {
        setSignupMsg("회원가입에 성공했습니다");
      } else {
        const data = await res.json();
        setSignupMsg(data.error || "회원가입 실패");
      }
    } catch (e) {
      setSignupMsg("서버 오류");
    }
  };

  return (
    <div className="title-bg">
      <img className="title-img pixel-bounce" src={titleImg} alt="title" />
      <div className="title-btns">
        <img
          className="title-btn-img"
          src={btnLoginImg}
          alt="login"
          onClick={() => { setShowLogin(true); setShowSignup(false); }}
        />
        <img
          className="title-btn-img"
          src={btnSignupImg}
          alt="signup"
          onClick={() => { setShowSignup(true); setShowLogin(false); }}
        />
        {showLogin && (
          <div className="title-dropdown">
            <button className="dropdown-close" onClick={() => setShowLogin(false)}>×</button>
            <input className="pixel-input" placeholder="ID" value={loginId} onChange={e => setLoginId(e.target.value)} />
            <input className="pixel-input" type="password" placeholder="PW" value={loginPw} onChange={e => setLoginPw(e.target.value)} />
            <button className="pixel-btn" onClick={handleLogin}>로그인</button>
            {loginMsg && <div className="pixel-msg">{loginMsg}</div>}
          </div>
        )}
        {showSignup && (
          <div className="title-dropdown">
            <button className="dropdown-close" onClick={() => setShowSignup(false)}>×</button>
            <input className="pixel-input" placeholder="ID" value={signupId} onChange={e => setSignupId(e.target.value)} />
            <input className="pixel-input" type="password" placeholder="PW" value={signupPw} onChange={e => setSignupPw(e.target.value)} />
            <button className="pixel-btn" onClick={handleSignup}>회원가입</button>
            {signupMsg && <div className="pixel-msg">{signupMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
} 