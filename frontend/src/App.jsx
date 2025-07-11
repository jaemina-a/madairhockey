import { useState, useEffect } from "react";
import LoginPage from "./components/LoginPage";
import GameBoard from "./components/GameBoard";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");

  // 컴포넌트 마운트 시 localStorage에서 로그인 상태 확인
  useEffect(() => {
    const savedUsername = localStorage.getItem("airhockey_username");
    if (savedUsername) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (user) => {
    setUsername(user);
    setIsLoggedIn(true);
    localStorage.setItem("airhockey_username", user);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    localStorage.removeItem("airhockey_username");
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div>
      <div style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}>
        <span style={{
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "5px 10px",
          borderRadius: "15px",
          fontSize: "14px"
        }}>
          👤 {username}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(220, 53, 69, 0.9)",
            color: "white",
            border: "none",
            padding: "5px 10px",
            borderRadius: "15px",
            cursor: "pointer",
            fontSize: "14px",
            transition: "background 0.2s ease"
          }}
          onMouseEnter={(e) => e.target.style.background = "rgba(220, 53, 69, 1)"}
          onMouseLeave={(e) => e.target.style.background = "rgba(220, 53, 69, 0.9)"}
        >
          로그아웃
        </button>
      </div>
      <GameBoard />
    </div>
  );
}