import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TitlePage from "./components/TitlePage";
import MyPage from "./components/MyPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/mypage" element={<MyPage />} />
      </Routes>
    </Router>
  );
}