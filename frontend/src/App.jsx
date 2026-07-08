import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SearchProvider } from './contexts/SearchContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import WordBookPage from './pages/WordBookPage';
import ReviewPage from './pages/ReviewPage';
import './styles/index.css';

export default function App() {
  return (
    <BrowserRouter>
      <SearchProvider>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/wordbook" element={<WordBookPage />} />
              <Route path="/review" element={<ReviewPage />} />
            </Routes>
          </main>
        </div>
      </SearchProvider>
    </BrowserRouter>
  );
}
