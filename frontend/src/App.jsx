import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TitlePage from "./components/TitlePage";
import MyPage from "./components/MyPage";
import GameBoard from "./components/GameBoard";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/game" element={<GameBoard />} />
      </Routes>
    </Router>
  );
}