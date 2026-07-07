import { useState, useEffect } from 'react';
import { getWordList, deleteCollection } from '../api';
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
  const [words, setWords] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchWords = async () => {
    setLoading(true);
    try {
      const res = await getWordList({ q: search || undefined, page, size: 20 });
      setWords(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchWords();
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个单词吗？')) return;
    try {
      await deleteCollection(id);
      fetchWords();
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

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="wordbook-page">
      <h1>我的单词本</h1>

      <div className="wordbook-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索已收藏的单词..."
          className="search-input"
        />
        <button onClick={handleSearch} className="search-btn">搜索</button>
      </div>

      <div className="wordbook-stats">
        共 {total} 个单词
        <Link to="/review" className="review-link">
          {words.filter(w => !w.mastered && new Date(w.next_review) <= new Date()).length > 0
            ? `📝 今日有 ${words.filter(w => !w.mastered && new Date(w.next_review) <= new Date()).length} 个单词待复习`
            : '📝 去复习'}
        </Link>
      </div>

      {loading && <div className="loading">加载中...</div>}

      <div className="word-list">
        {words.map((item) => (
          <div key={item.id} className="word-list-item">
            <div
              className="word-list-header"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
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
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                >
                  删除
                </button>
              </div>
            </div>
            {expandedId === item.id && (
              <div className="word-list-detail">
                <p>下次复习: {new Date(item.next_review).toLocaleDateString('zh-CN')}</p>
                <p>复习次数: {item.review_count}</p>
                <p>收藏时间: {new Date(item.collected_at).toLocaleString('zh-CN')}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && words.length === 0 && (
        <div className="empty-state">
          <p>还没有收藏任何单词</p>
          <Link to="/" className="go-search">去查词</Link>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}
