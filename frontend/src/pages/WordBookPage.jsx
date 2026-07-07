import { useState, useEffect } from 'react';
import { getWordList, deleteCollection, getSentences, deleteSentence } from '../api';
import { Link } from 'react-router-dom';
import '../styles/WordBookPage.css';

const STAGE_LABELS = {
  0: '新收藏',
  1: '1天后',
  2: '2天后',
  3: '4天后',
  4: '7天后',
  5: '15天后',
  6: '30天后',
  7: '90天后',
};

export default function WordBookPage() {
  const [items, setItems] = useState([]); // 合并后的列表（单词 + 句子）
  const [wordTotal, setWordTotal] = useState(0);
  const [sentenceTotal, setSentenceTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wordRes, sentRes] = await Promise.all([
        getWordList({ q: search || undefined, page: 1, size: 200 }),
        getSentences(),
      ]);
      const words = (wordRes.data.items || []).map((w) => ({ ...w, kind: 'word' }));
      const sentences = (sentRes.data.items || []).map((s) => ({ ...s, kind: 'sentence' }));

      const kw = search.trim().toLowerCase();
      const filteredWords = kw
        ? words.filter((w) => w.word.toLowerCase().includes(kw))
        : words;
      const filteredSentences = kw
        ? sentences.filter(
            (s) =>
              s.original.toLowerCase().includes(kw) ||
              (s.translation || '').toLowerCase().includes(kw)
          )
        : sentences;

      setWordTotal(wordRes.data.total || 0);
      setSentenceTotal(sentRes.data.total || 0);
      // 单词在前，句子在后
      setItems([...filteredWords, ...filteredSentences]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    fetchAll();
  };

  const handleDelete = async (item) => {
    if (!confirm(item.kind === 'word' ? '确定要删除这个单词吗？' : '确定要删除这个句子吗？')) return;
    try {
      if (item.kind === 'word') await deleteCollection(item.id);
      else await deleteSentence(item.id);
      fetchAll();
    } catch (err) {
      alert('删除失败');
    }
  };

  const getStageColor = (stage, mastered) => {
    if (mastered) return 'mastered';
    if (stage <= 2) return 'stage-short';
    if (stage <= 5) return 'stage-mid';
    return 'stage-long';
  };

  const dueCount = items.filter(
    (w) => w.kind === 'word' && !w.mastered && new Date(w.next_review) <= new Date()
  ).length;

  return (
    <div className="wordbook-page">
      <h1>我的收藏本</h1>
      <p className="wordbook-sub">已收藏的单词与句子都在这里</p>

      <div className="wordbook-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索已收藏的单词或句子..."
          className="search-input"
        />
        <button onClick={handleSearch} className="search-btn">搜索</button>
      </div>

      <div className="wordbook-stats">
        共 {wordTotal} 个单词 · {sentenceTotal} 个句子
        <Link to="/review" className="review-link">
          {dueCount > 0 ? `📝 今日有 ${dueCount} 个单词待复习` : '📝 去复习'}
        </Link>
      </div>

      {loading && <div className="loading">加载中...</div>}

      <div className="word-list">
        {items.map((item) =>
          item.kind === 'word' ? (
            <div key={`w-${item.id}`} className="word-list-item">
              <div
                className="word-list-header"
                onClick={() => setExpandedId(expandedId === `w-${item.id}` ? null : `w-${item.id}`)}
              >
                <div className="word-list-main">
                  <span className="word-text">{item.word}</span>
                  <span className="word-phonetic">
                    {item.phonetics_us || item.phonetics_uk || ''}
                  </span>
                  <span className={`stage-badge ${getStageColor(item.review_stage, item.mastered)}`}>
                    {item.mastered ? '已掌握' : STAGE_LABELS[item.review_stage] || `阶段${item.review_stage}`}
                  </span>
                </div>
                <div className="word-list-actions">
                  <span className="word-summary">{item.definitions_summary}</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                  >
                    删除
                  </button>
                </div>
              </div>
              {expandedId === `w-${item.id}` && (
                <div className="word-list-detail">
                  <p>下次复习: {new Date(item.next_review).toLocaleDateString('zh-CN')}</p>
                  <p>复习次数: {item.review_count}</p>
                  <p>收藏时间: {new Date(item.collected_at).toLocaleString('zh-CN')}</p>
                </div>
              )}
            </div>
          ) : (
            <div key={`s-${item.id}`} className="sentence-list-item">
              <div
                className="sentence-list-header"
                onClick={() => setExpandedId(expandedId === `s-${item.id}` ? null : `s-${item.id}`)}
              >
                <div className="sentence-list-main">
                  <span className="kind-badge sentence">句子</span>
                  <span className="sentence-text">{item.original}</span>
                  {item.translation && (
                    <span className="sentence-translation">{item.translation}</span>
                  )}
                </div>
                <div className="word-list-actions">
                  <span className="word-summary">
                    {new Date(item.collected_at).toLocaleDateString('zh-CN')}
                  </span>
                  <button
                    className="delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                  >
                    删除
                  </button>
                </div>
              </div>
              {expandedId === `s-${item.id}` && item.words_json && (
                <div className="sentence-list-detail">
                  {(() => {
                    try {
                      const words = JSON.parse(item.words_json);
                      return words.map((w, i) => (
                        <div key={i} className="sentence-word-item">
                          <strong>{w.word}</strong>
                          {w.definitions && w.definitions.length > 0 && (
                            <span> — {w.definitions[0].meaning}</span>
                          )}
                        </div>
                      ));
                    } catch {
                      return <p>逐词解析解析失败</p>;
                    }
                  })()}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <p>还没有收藏任何单词或句子</p>
          <Link to="/" className="go-search">去查词</Link>
        </div>
      )}
    </div>
  );
}
