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
  const [items, setItems] = useState([]);
  const [wordTotal, setWordTotal] = useState(0);
  const [sentenceTotal, setSentenceTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  // 右侧抽屉状态
  const [drawerItem, setDrawerItem] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wordRes, sentRes] = await Promise.all([
        getWordList({ q: search || undefined, page: 1, size: 1000 }),
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
      setSentenceTotal(sentRes.data.items?.length || 0);
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
      if (drawerItem && drawerItem.id === item.id) setDrawerItem(null);
      fetchAll();
    } catch (err) {
      alert('删除失败');
    }
  };

  const dueCount = items.filter(
    (w) => w.kind === 'word' && !w.mastered && new Date(w.next_review) <= new Date()
  ).length;

  /** 双击打开抽屉 */
  const openDrawer = (e, item) => {
    e.preventDefault();
    setDrawerItem(item);
  };

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

      {/* ===== 列表区（每行一项，只显示英文）===== */}
      <div className={`collection-list ${drawerItem ? 'drawer-open' : ''}`}>
        {items.map((item, idx) => (
          <div
            key={`${item.kind}-${item.id}`}
            className={`collection-row ${drawerItem?.id === item.id ? 'active' : ''}`}
            onDoubleClick={(e) => openDrawer(e, item)}
          >
            <span className="row-index">{String(idx + 1).padStart(2, '0')}</span>
            <span className="row-text" title={item.kind === 'word' ? item.word : item.original}>
              {item.kind === 'word' ? item.word : item.original}
            </span>
            <span className="row-date">{new Date(item.collected_at).toLocaleDateString('zh-CN')}</span>
          </div>
        ))}
      </div>

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <p>还没有收藏任何单词或句子</p>
          <Link to="/" className="go-search">去查词</Link>
        </div>
      )}

      {/* ===== 右侧抽屉（双击展开详情）===== */}
      {drawerItem && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerItem(null)} />
          <aside className="detail-drawer">
            <button className="drawer-close" onClick={() => setDrawerItem(null)}>✕</button>

            {drawerItem.kind === 'word' ? (
              <>
                {/* 单词详情 */}
                <h2 className="drawer-title">{drawerItem.word}</h2>
                {(drawerItem.phonetics_uk || drawerItem.phonetics_us) && (
                  <div className="drawer-phonetic">
                    {drawerItem.phonetics_uk && (
                      <span>英 /{drawerItem.phonetics_uk}/</span>
                    )}
                    {drawerItem.phonetics_us && (
                      <span style={{ marginLeft: 16 }}>美 /{drawerItem.phonetics_us}/</span>
                    )}
                  </div>
                )}
                <div className="drawer-section">
                  <h3>释义</h3>
                  <p className="drawer-def">{drawerItem.definitions || drawerItem.definitions_summary}</p>
                </div>
                <div className="drawer-meta">
                  <span>{STAGE_LABELS[drawerItem.review_stage] ?? `阶段${drawerItem.review_stage}`}</span>
                  <span>下次: {new Date(drawerItem.next_review).toLocaleDateString('zh-CN')}</span>
                  <span>复习: {drawerItem.review_count ?? 0} 次</span>
                  <span>收藏: {new Date(drawerItem.collected_at).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="drawer-footer">
                  <button
                    className="drawer-delete-btn"
                    onClick={() => handleDelete(drawerItem)}
                  >
                    删除此单词
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 句子详情 */}
                <h2 className="drawer-title">{drawerItem.original}</h2>
                <div className="drawer-section">
                  <h3>翻译</h3>
                  <p className="drawer-trans">{drawerItem.translation || '（无翻译）'}</p>
                </div>
                <div className="drawer-meta">
                  <span>收藏时间: {new Date(drawerItem.collected_at).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="drawer-footer">
                  <button
                    className="drawer-delete-btn"
                    onClick={() => handleDelete(drawerItem)}
                  >
                    删除此句子
                  </button>
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
