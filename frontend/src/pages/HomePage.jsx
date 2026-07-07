import { useState } from 'react';
import SearchBar from '../components/SearchBar';
import WordCard from '../components/WordCard';
import { lookupWord, querySentence, collectWord, deleteCollection, collectSentence } from '../api';
import '../styles/HomePage.css';

export default function HomePage() {
  const [mode, setMode] = useState('word');
  const [input, setInput] = useState('');
  const [results, setResults] = useState(null);
  const [sentenceResult, setSentenceResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 句子相关状态
  const [sentenceCollected, setSentenceCollected] = useState(false);
  const [showWordDetail, setShowWordDetail] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const handleSearch = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSentenceResult(null);
    setSentenceCollected(false);
    setShowWordDetail(false);

    try {
      if (mode === 'word') {
        const res = await lookupWord(input.trim());
        setResults(res.data);
      } else {
        const res = await querySentence(input.trim());
        // 句子模式下，若有单词查询失败，给出整体提示
        const failed = res.data.words.filter((w) => w.error).length;
        setSentenceResult(res.data);
        if (failed > 0) {
          setError(`句子中的 ${failed} 个单词查询失败（可能是网络波动或额度限制），已正常显示其余单词`);
        }
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError(err.response?.data?.detail || '今日免费查询额度已用完，请稍后重试');
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('网络连接异常，请检查网络后点击重试');
      } else {
        setError(err.response?.data?.detail || '查询失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async (word) => {
    try {
      await collectWord(word);
      // 刷新收藏状态
      if (results && results.word === word) {
        setResults({ ...results, is_collected: true });
      }
      if (sentenceResult) {
        setSentenceResult({
          ...sentenceResult,
          words: sentenceResult.words.map((w) =>
            w.word === word ? { ...w, is_collected: true } : w
          ),
        });
      }
    } catch (err) {
      alert(err.response?.data?.detail || '收藏失败');
    }
  };

  // 收藏整句
  const handleCollectSentence = async () => {
    if (!sentenceResult) return;
    try {
      await collectSentence(
        sentenceResult.original,
        null,  // 翻译暂不填，后续可接入翻译 API
        JSON.stringify(sentenceResult.words)
      );
      setSentenceCollected(true);
    } catch (err) {
      alert(err.response?.data?.detail || '句子收藏失败');
    }
  };

  // 整句朗读（浏览器原生 TTS）
  const speakSentence = () => {
    if (!sentenceResult || !window.speechSynthesis) return;
    // 停止正在播放的
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentenceResult.original);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;  // 稍慢一点便于学习
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>英语单词本</h1>
        <p className="hero-subtitle">查询单词释义，收藏到单词本，科学复习记忆</p>
        <SearchBar
          value={input}
          onChange={setInput}
          onSearch={handleSearch}
          mode={mode}
          onModeChange={setMode}
          placeholder={mode === 'word' ? '输入英文单词，如: present' : '输入英语句子，如: I have a dream'}
        />
      </div>

      {loading && <div className="loading">查询中...</div>}

      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button className="retry-btn" onClick={handleSearch} disabled={loading}>
            {loading ? '重试中...' : '重试'}
          </button>
        </div>
      )}

      {results && (
        <div className="results-section">
          <WordCard
            wordData={results}
            onCollect={handleCollect}
          />
        </div>
      )}

      {sentenceResult && (
        <div className="results-section">
          {/* ===== 整句卡片 ===== */}
          <div className="sentence-card">
            <div className="sentence-card-header">
              <p className="sentence-text">{sentenceResult.original}</p>
              <div className="sentence-actions">
                {/* 整句朗读 */}
                <button
                  className={`speak-btn ${speaking ? 'speaking' : ''}`}
                  onClick={speakSentence}
                  disabled={speaking}
                  title="朗读整句"
                >
                  {speaking ? '🔊 播放中' : '🔈 朗读'}
                </button>
                {/* 收藏整句 */}
                <button
                  className={`sentence-collect-btn ${sentenceCollected ? 'collected' : ''}`}
                  onClick={handleCollectSentence}
                  disabled={sentenceCollected}
                  title={sentenceCollected ? '已收藏句子' : '收藏到句子本'}
                >
                  {sentenceCollected ? '★ 已收藏' : '☆ 收藏句子'}
                </button>
              </div>
            </div>

            {/* 可展开的逐词详情 */}
            {sentenceResult.words.length > 0 && (
              <div className="sentence-word-detail">
                <button
                  className="toggle-detail-btn"
                  onClick={() => setShowWordDetail(!showWordDetail)}
                >
                  {showWordDetail ? '▼ 收起逐词解析' : '▶ 展开逐词解析'}
                  ({sentenceResult.words.filter(w => !w.error).length}/{sentenceResult.words.length} 词)
                </button>
                {showWordDetail && (
                  <div className="sentence-words-list">
                    {sentenceResult.words.map((w, i) => (
                      <WordCard
                        key={`${w.word}-${i}`}
                        wordData={{ ...w, is_collected: w.is_collected || false }}
                        onCollect={handleCollect}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!results && !sentenceResult && !loading && !error && (
        <div className="empty-hint">
          <p>输入单词或句子，开始学习吧！</p>
        </div>
      )}
    </div>
  );
}
