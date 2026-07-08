import { useState, useRef, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import WordCard from '../components/WordCard';
import { lookupWord, querySentence, collectWord, collectSentence, getSentenceAudioUrl } from '../api';
import { useSearchState } from '../contexts/SearchContext';
import '../styles/HomePage.css';

// 判断输入是「单个单词」还是「短语/句子」
function isSingleWord(input) {
  const trimmed = input.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length === 1 && /^[a-zA-Z][a-zA-Z'’-]*$/.test(tokens[0]);
}

export default function HomePage() {
  const stateRef = useSearchState();

  // 从持久化 ref 恢复状态：首次挂载创建默认值，切换页面回来时复用之前的值
  const [state, setState] = useState(() => {
    if (stateRef.current) return stateRef.current;
    return {
      input: '',
      results: null,
      sentenceResult: null,
      error: null,
      sentenceCollected: false,
    };
  });

  // 每次持久状态变更 → 同步回 ref，确保跨路由不丢失
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const { input, results, sentenceResult, error, sentenceCollected } = state;

  // 便捷更新：合并部分字段到 state
  const updateState = (partial) => setState((prev) => ({ ...prev, ...partial }));

  // 纯瞬态状态（不需要跨路由保持）
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(null); // null | 'youdao' | 'edge'
  const audioRef = useRef(null);

  const handleSearch = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    updateState({ error: null, results: null, sentenceResult: null, sentenceCollected: false });
    setIsSpeaking(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }

    try {
      if (isSingleWord(trimmed)) {
        const res = await lookupWord(trimmed);
        updateState({ results: res.data });
      } else {
        const res = await querySentence(trimmed);
        const failed = res.data.words.filter((w) => w.error).length;
        updateState({ sentenceResult: res.data });
        if (failed > 0) {
          updateState({ error: `句子中的 ${failed} 个单词查询失败（可能是网络波动或额度限制），已正常显示其余内容` });
        }
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        updateState({ error: err.response?.data?.detail || '今日免费查询额度已用完，请稍后重试' });
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        updateState({ error: '网络连接异常，请检查网络后点击重试' });
      } else {
        updateState({ error: err.response?.data?.detail || '查询失败，请稍后重试' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async (word) => {
    try {
      await collectWord(word);
      if (results && results.word === word) {
        updateState({ results: { ...results, is_collected: true } });
      }
      if (sentenceResult) {
        updateState({
          sentenceResult: {
            ...sentenceResult,
            words: sentenceResult.words.map((w) =>
              w.word === word ? { ...w, is_collected: true } : w
            ),
          },
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
      updateState({ sentenceCollected: true });
    } catch (err) {
      alert(err.response?.data?.detail || '句子收藏失败');
    }
  };

  // 浏览器 SpeechSynthesis 降级（后端 TTS 不可用时自动切换）
  const speakWithBrowser = (text) => {
    if (!window.speechSynthesis) {
      setIsSpeaking(null);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.9;
    utter.onend = () => setIsSpeaking(null);
    utter.onerror = () => setIsSpeaking(null);
    window.speechSynthesis.speak(utter);
  };

  // 整句朗读：指定 TTS 服务商（youdao | edge），失败降级到浏览器语音合成
  const playSentence = (source) => {
    if (!sentenceResult) return;

    // 停止所有正在播放的音频
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis?.cancel();

    const text = sentenceResult.original;
    setIsSpeaking(source);

    // 如果 audio 元素不可用，直接走浏览器降级
    if (!audioRef.current) {
      speakWithBrowser(text);
      return;
    }

    // 尝试指定服务商的后端 TTS
    audioRef.current.src = getSentenceAudioUrl(text, 'en-US', source);
    audioRef.current.onended = () => setIsSpeaking(null);

    // 后端 TTS 失败 → 自动切换到浏览器语音合成
    audioRef.current.onerror = () => {
      speakWithBrowser(text);
    };

    audioRef.current.play().catch(() => {
      speakWithBrowser(text);
    });
  };

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>英语记忆手册</h1>
        <p className="hero-subtitle">输入单词、短语或句子，查询释义、整句翻译与发音，科学复习记忆</p>
        <SearchBar
          value={input}
          onChange={(val) => updateState({ input: val })}
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
                  className={`speak-btn youdao ${isSpeaking === 'youdao' ? 'speaking' : ''}`}
                  onClick={() => playSentence('youdao')}
                  title="有道朗读"
                >
                  {isSpeaking === 'youdao' ? '🔊' : '🔈'} 有道
                </button>
                <button
                  className={`speak-btn edge ${isSpeaking === 'edge' ? 'speaking' : ''}`}
                  onClick={() => playSentence('edge')}
                  title="Edge TTS 朗读（神经网络语音）"
                >
                  {isSpeaking === 'edge' ? '🔊' : '🔈'} Edge
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
