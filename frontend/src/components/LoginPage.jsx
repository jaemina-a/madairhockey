import { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsLoading(true);
      // 바로 로그인 처리 (더미 데이터 사용)
      setTimeout(() => {
        onLogin(username.trim());
        setIsLoading(false);
      }, 500);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100vw",
      height: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      overflow: "hidden"
    }}>
      <div style={{
        background: "rgba(255, 255, 255, 0.95)",
        padding: "2rem",
        borderRadius: "16px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        width: "100%",
        maxWidth: "400px"
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{
            fontSize: "2.5rem",
            fontWeight: "bold",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: "0 0 0.5rem 0"
          }}>
            🏓 Air Hockey
          </h1>
          <p style={{
            color: "#666",
            fontSize: "1.1rem",
            margin: "0"
          }}>
            실시간 멀티플레이어 게임
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label htmlFor="username" style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "600",
              color: "#333"
            }}>
              사용자명
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="사용자명을 입력하세요"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "2px solid #e1e5e9",
                borderRadius: "8px",
                fontSize: "1rem",
                transition: "border-color 0.2s ease",
                boxSizing: "border-box"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e1e5e9";
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={!username.trim() || isLoading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: username.trim() && !isLoading 
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: username.trim() && !isLoading ? "pointer" : "not-allowed",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)"
            }}
            onMouseEnter={(e) => {
              if (username.trim() && !isLoading) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (username.trim() && !isLoading) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.3)";
              }
            }}
          >
            {isLoading ? "로그인 중..." : "게임 시작"}
          </button>
        </form>

        <div style={{
          marginTop: "1.5rem",
          padding: "1rem",
          background: "rgba(102, 126, 234, 0.1)",
          borderRadius: "8px",
          border: "1px solid rgba(102, 126, 234, 0.2)"
        }}>
          <h3 style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1rem",
            color: "#667eea"
          }}>
            🎮 게임 방법
          </h3>
          <ul style={{
            margin: "0",
            paddingLeft: "1.2rem",
            fontSize: "0.9rem",
            color: "#666"
          }}>
            <li>사용자명을 입력하고 게임을 시작하세요</li>
            <li>다른 플레이어와 자동으로 매칭됩니다</li>
            <li>왼쪽: W/S 키, 오른쪽: ↑/↓ 키로 패들을 조작하세요</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 