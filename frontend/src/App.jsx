import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import WordBookPage from './pages/WordBookPage';
import ReviewPage from './pages/ReviewPage';
import SentencesPage from './pages/SentencesPage';
import './styles/index.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/wordbook" element={<WordBookPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/sentences" element={<SentencesPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
