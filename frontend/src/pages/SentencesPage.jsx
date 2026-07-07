import { useState, useEffect, useRef } from 'react';
import { getSentences, deleteSentence, getSentenceAudioUrl } from '../api';
import '../styles/SentencesPage.css';

export default function SentencesPage() {
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  // 音频播放 ref
  const audioRef = useRef(null);

  const fetchSentences = async () => {
    setLoading(true);
    try {
      const res = await getSentences();
      setSentences(res.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentences();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个句子吗？')) return;
    try {
      await deleteSentence(id);
      setSentences(sentences.filter((s) => s.id !== id));
    } catch (err) {
      alert('删除失败');
    }
  };

  // 朗读指定句子
  const playSentence = (original) => {
    if (!original) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = getSentenceAudioUrl(original);
      audioRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="sentences-page">
      <h1>句子收藏</h1>
      {/* 隐藏的音频元素 */}
      <audio ref={audioRef} preload="none" style={{ display: 'none' }} />

      {loading && <div className="loading">加载中...</div>}

      <div className="sentence-list">
        {sentences.map((s) => (
          <div key={s.id} className="sentence-card">
            <div
              className="sentence-header"
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            >
              <p className="sentence-original">"{s.original}"</p>
              {s.translation && (
                <p className="sentence-translation">{s.translation}</p>
              )}
              <span className="sentence-date">
                {new Date(s.collected_at).toLocaleDateString('zh-CN')}
              </span>
              <button
                className="sentence-speak-btn"
                title="朗读该句"
                onClick={(e) => {
                  e.stopPropagation();
                  playSentence(s.original);
                }}
              >
                🔈
              </button>
            </div>
            {expandedId === s.id && s.words_json && (
              <div className="sentence-words">
                {(() => {
                  try {
                    const words = JSON.parse(s.words_json);
                    return words.map((w, i) => (
                      <div key={i} className="sentence-word-item">
                        <strong>{w.word}</strong>
                        {w.definitions && w.definitions.length > 0 && (
                          <span> — {w.definitions[0].meaning}</span>
                        )}
                      </div>
                    ));
                  } catch {
                    return <p>解析失败</p>;
                  }
                })()}
              </div>
            )}
            <button
              className="delete-btn"
              onClick={() => handleDelete(s.id)}
            >
              删除
            </button>
          </div>
        ))}
      </div>

      {!loading && sentences.length === 0 && (
        <div className="empty-state">
          <p>还没有收藏任何句子</p>
        </div>
      )}
    </div>
  );
}
