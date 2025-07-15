import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TitlePage from "./components/TitlePage";
import MyPage from "./components/MyPage";
import GameBoard from "./components/GameBoard";
import GameLoading from "./components/GameLoading";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/game" element={<GameBoard />} />
        <Route path="/load_game" element={<GameLoading />} />
      </Routes>
    </Router>
  );
}