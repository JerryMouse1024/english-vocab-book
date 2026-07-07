import { useState, useRef } from 'react';
import SearchBar from '../components/SearchBar';
import WordCard from '../components/WordCard';
import { lookupWord, querySentence, collectWord, deleteCollection, collectSentence, getSentenceAudioUrl } from '../api';
import '../styles/HomePage.css';

// 判断输入是「单个单词」还是「短语/句子」
function isSingleWord(input) {
  const trimmed = input.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length === 1 && /^[a-zA-Z][a-zA-Z'’-]*$/.test(tokens[0]);
}

export default function HomePage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState(null);
  const [sentenceResult, setSentenceResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 句子相关状态
  const [sentenceCollected, setSentenceCollected] = useState(false);
  const [showWordDetail, setShowWordDetail] = useState(false);
  // 音频播放 ref
  const audioRef = useRef(null);

  const handleSearch = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSentenceResult(null);
    setSentenceCollected(false);
    setShowWordDetail(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }

    try {
      if (isSingleWord(trimmed)) {
        const res = await lookupWord(trimmed);
        setResults(res.data);
      } else {
        const res = await querySentence(trimmed);
        const failed = res.data.words.filter((w) => w.error).length;
        setSentenceResult(res.data);
        if (failed > 0) {
          setError(`句子中的 ${failed} 个单词查询失败（可能是网络波动或额度限制），已正常显示其余内容`);
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

  // 收藏整句（含翻译）
  const handleCollectSentence = async () => {
    if (!sentenceResult) return;
    try {
      await collectSentence(
        sentenceResult.original,
        sentenceResult.translation || null,
        JSON.stringify(sentenceResult.words)
      );
      setSentenceCollected(true);
    } catch (err) {
      alert(err.response?.data?.detail || '句子收藏失败');
    }
  };

  // 整句朗读（通过在线 TTS 音频流）
  const playSentence = () => {
    if (!sentenceResult) return;
    if (audioRef.current) {
      // 停止当前正在播放的
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // 设置新的音频源并播放
      audioRef.current.src = getSentenceAudioUrl(sentenceResult.original);
      audioRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>英语单词本</h1>
        <p className="hero-subtitle">输入单词、短语或句子，查询释义、整句翻译与发音，科学复习记忆</p>
        <SearchBar
          value={input}
          onChange={setInput}
          onSearch={handleSearch}
          placeholder="输入英文单词、短语或句子，如: present / what is it?"
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

      {/* 单个单词：词典卡片 */}
      {results && (
        <div className="results-section">
          <WordCard
            wordData={results}
            onCollect={handleCollect}
          />
        </div>
      )}

      {/* 短语 / 句子：整句卡片 */}
      {sentenceResult && (
        <div className="results-section">
          <div className="sentence-card">
            <div className="sentence-card-header">
              <div className="sentence-text-block">
                <p className="sentence-text">{sentenceResult.original}</p>
                {sentenceResult.translation && (
                  <p className="sentence-translation">{sentenceResult.translation}</p>
                )}
              </div>
              <div className="sentence-actions">
                {/* 整句朗读 —— 用 <audio> 播放 TTS 音频流 */}
                <audio ref={audioRef} preload="none" style={{ display: 'none' }} />
                <button
                  className="speak-btn"
                  onClick={playSentence}
                  title="朗读整句"
                >
                  🔈 朗读
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
                  ({sentenceResult.words.filter((w) => !w.error).length}/{sentenceResult.words.length} 词)
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
