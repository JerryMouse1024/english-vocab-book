import { useState, useEffect } from 'react';
import { getWordList, deleteCollection, getSentences, deleteSentence, updateSentence } from '../api';
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
  // 编辑翻译
  const [editingTrans, setEditingTrans] = useState(false);
  const [editTransValue, setEditTransValue] = useState('');
  // 删除确认
  const [confirmItem, setConfirmItem] = useState(null);

  const fetchAll = async (overrideSearch) => {
    setLoading(true);
    try {
      const q = overrideSearch !== undefined ? overrideSearch : search;
      const [wordRes, sentRes] = await Promise.all([
        getWordList({ q: q || undefined, page: 1, size: 1000 }),
        getSentences(),
      ]);
      const words = (wordRes.data.items || []).map((w) => ({ ...w, kind: 'word' }));
      const sentences = (sentRes.data.items || []).map((s) => ({ ...s, kind: 'sentence' }));

      const kw = q.trim().toLowerCase();
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

      setWordTotal(filteredWords.length);
      setSentenceTotal(filteredSentences.length);
      // 按收藏时间降序排列（最新在前），单词和句子混排
      const merged = [...filteredWords, ...filteredSentences];
      merged.sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at));
      setItems(merged);
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

  const handleDelete = async () => {
    if (!confirmItem) return;
    const item = confirmItem;
    setConfirmItem(null);
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
    (item) => !item.mastered && new Date(item.next_review) <= new Date()
  ).length;

  /** 双击打开抽屉 */
  const openDrawer = (e, item) => {
    e.preventDefault();
    setDrawerItem(item);
    setEditingTrans(false);
    setEditTransValue('');
  };

  /** 保存编辑后的翻译 */
  const saveTranslation = async () => {
    if (!drawerItem) return;
    try {
      await updateSentence(drawerItem.id, editTransValue.trim());
      setDrawerItem({ ...drawerItem, translation: editTransValue.trim() });
      setEditingTrans(false);
      // 同步更新列表中的翻译
      setItems((prev) =>
        prev.map((it) =>
          it.kind === 'sentence' && it.id === drawerItem.id
            ? { ...it, translation: editTransValue.trim() }
            : it
        )
      );
    } catch {
      alert('保存失败');
    }
  };

  /** 熟练度标签文字 */
  const getBadgeLabel = (item) => {
    if (item.mastered) return '已掌握';
    const stage = item.review_stage ?? 0;
    return STAGE_LABELS[stage] ?? `阶段${stage}`;
  };

  /** 熟练度标签样式类 */
  const getBadgeClass = (item) => {
    if (item.mastered) return 'badge-mastered';
    const stage = item.review_stage ?? 0;
    if (stage === 0) return 'badge-new';
    if (stage <= 2) return 'badge-learning';
    if (stage <= 4) return 'badge-progress';
    return 'badge-solid';
  };

  return (
    <div className="wordbook-page">
      <h1>我的收藏本</h1>
      <p className="wordbook-sub">已收藏的单词与句子都在这里</p>

      <div className="wordbook-search">
        <div className="search-input-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索已收藏的单词或句子..."
            className="search-input"
          />
          {search && (
            <button
              className="search-clear-btn"
              onClick={() => { setSearch(''); fetchAll(''); }}
              title="清空搜索"
              type="button"
            >
              ✕
            </button>
          )}
        </div>
        <button onClick={handleSearch} className="search-btn">搜索</button>
      </div>

      <div className="wordbook-stats">
        共 {wordTotal} 个单词 · {sentenceTotal} 个句子
        <Link to="/review" className="review-link">
          {dueCount > 0 ? `📝 今日有 ${dueCount} 项待复习` : '📝 去复习'}
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
            <span className={`row-badge ${getBadgeClass(item)}`}>
              {getBadgeLabel(item)}
            </span>
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
                    onClick={() => setConfirmItem(drawerItem)}
                  >
                    删除
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 句子详情 */}
                <h2 className="drawer-title">{drawerItem.original}</h2>
                <div className="drawer-section">
                  <h3>翻译</h3>
                  {editingTrans ? (
                    <div className="drawer-edit-row">
                      <textarea
                        className="drawer-edit-input"
                        value={editTransValue}
                        onChange={(e) => setEditTransValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveTranslation();
                          }
                          if (e.key === 'Escape') setEditingTrans(false);
                        }}
                        autoFocus
                        rows={2}
                      />
                      <div className="drawer-edit-actions">
                        <button className="drawer-save-btn" onClick={saveTranslation}>保存</button>
                        <button className="drawer-cancel-btn" onClick={() => setEditingTrans(false)}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <p className="drawer-trans">{drawerItem.translation || '（无翻译）'}</p>
                  )}
                </div>
                <div className="drawer-meta">
                  <span>收藏时间: {new Date(drawerItem.collected_at).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="drawer-footer">
                  {!editingTrans && (
                    <button
                      className="drawer-edit-btn"
                      onClick={() => {
                        setEditTransValue(drawerItem.translation || '');
                        setEditingTrans(true);
                      }}
                    >
                      编辑翻译
                    </button>
                  )}
                  <button
                    className="drawer-delete-btn"
                    onClick={() => setConfirmItem(drawerItem)}
                  >
                    删除
                  </button>
                </div>
              </>
            )}
          </aside>
        </>
      )}

      {/* ===== 删除确认弹窗 ===== */}
      {confirmItem && (
        <div className="confirm-overlay" onClick={() => setConfirmItem(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-text">
              确定要删除 <strong>「{confirmItem.kind === 'word' ? confirmItem.word : confirmItem.original}」</strong> 吗？
            </p>
            <p className="confirm-hint">删除后不可恢复</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setConfirmItem(null)}>取消</button>
              <button className="confirm-delete" onClick={handleDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
