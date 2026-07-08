import { useState, useEffect, useRef } from 'react';
import { getWordList, deleteCollection, getSentences, deleteSentence, updateSentence, updateWordDefs, getSentenceAudioUrl } from '../api';
import { Link } from 'react-router-dom';
import WordCard from '../components/WordCard';
import PhoneticPlayer from '../components/PhoneticPlayer';
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
  // 编辑翻译/释义
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  // 删除确认
  const [confirmItem, setConfirmItem] = useState(null);
  // 句子朗读状态
  const sentenceAudioRef = useRef(null);
  const [sentenceSpeaking, setSentenceSpeaking] = useState(null); // null | 'youdao' | 'edge'
  // 音标冒泡：点击句子标题时显示，再次点击或点其他地方关闭
  const [phoneticTipId, setPhoneticTipId] = useState(null);

  /** 解析句子中的单词音标 */
  const parsePhonetics = (item) => {
    if (!item.words_json) return null;
    try {
      const words = JSON.parse(item.words_json);
      if (!Array.isArray(words)) return null;
      // 过滤有音标的单词
      return words.filter((w) => w.phonetics_uk || w.phonetics_us || w.phonetics);
    } catch {
      return null;
    }
  };

  /** 浏览器 SpeechSynthesis 降级 */
  const speakWithBrowser = (text) => {
    if (!window.speechSynthesis) { setSentenceSpeaking(null); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.9;
    utter.onend = () => setSentenceSpeaking(null);
    utter.onerror = () => setSentenceSpeaking(null);
    window.speechSynthesis.speak(utter);
  };

  /** 句子朗读（指定服务商） */
  const playSentenceTts = (source) => {
    if (!drawerItem || drawerItem.kind !== 'sentence') return;
    if (!sentenceAudioRef.current) { speakWithBrowser(drawerItem.original); return; }

    // 停止当前
    if (sentenceAudioRef.current) {
      sentenceAudioRef.current.pause();
      sentenceAudioRef.current.currentTime = 0;
    }
    window.speechSynthesis?.cancel();
    setSentenceSpeaking(source);

    const text = drawerItem.original;
    sentenceAudioRef.current.src = getSentenceAudioUrl(text, 'en-US', source);
    sentenceAudioRef.current.onended = () => setSentenceSpeaking(null);
    sentenceAudioRef.current.onerror = () => speakWithBrowser(text);
    sentenceAudioRef.current.play().catch(() => speakWithBrowser(text));
  };

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
    setEditing(false);
    setEditValue('');
    setSentenceSpeaking(null);
    setPhoneticTipId(null);
    if (sentenceAudioRef.current) {
      sentenceAudioRef.current.pause();
      sentenceAudioRef.current.currentTime = 0;
    }
  };

  /** 保存编辑后的翻译/释义 */
  const saveEdit = async () => {
    if (!drawerItem) return;
    const val = editValue.trim();
    if (!val) return;
    try {
      if (drawerItem.kind === 'word') {
        // 保存为 JSON 格式，兼容现有展示逻辑
        const defsJson = JSON.stringify([{ meaning: val }]);
        await updateWordDefs(drawerItem.word_id, defsJson);
        setDrawerItem({ ...drawerItem, definitions: val });
      } else {
        await updateSentence(drawerItem.id, val);
        setDrawerItem({ ...drawerItem, translation: val });
      }
      setEditing(false);
      setItems((prev) =>
        prev.map((it) => {
          if (it.kind === 'word' && it.id === drawerItem.id) {
            return { ...it, definitions: val };
          }
          if (it.kind === 'sentence' && it.id === drawerItem.id) {
            return { ...it, translation: val };
          }
          return it;
        })
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
      {/* ===== 左栏：搜索 + 列表 ===== */}
      <div className="wordbook-left">
      <div className="wordbook-header">
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

      </div>

      {/* ===== 列表区（左栏下半部分，内部滚动）===== */}
      <div className="collection-list">
        {loading && <div className="loading">加载中...</div>}
          {items.map((item, idx) => (
            <div
              key={`${item.kind}-${item.id}`}
              className={`collection-row ${drawerItem?.kind === item.kind && drawerItem?.id === item.id ? 'active' : ''}`}
              onClick={(e) => openDrawer(e, item)}
            >
              <span className="row-index">{String(idx + 1).padStart(2, '0')}</span>
              <span className="row-text" title={item.kind === 'word' ? item.word : item.original}>
                {item.kind === 'word' ? item.word : item.original}
              </span>
              {item.kind === 'word' && item.phonetics_uk && (
                <span className="row-phonetic">/{item.phonetics_uk}/</span>
              )}
              <span className={`row-badge ${getBadgeClass(item)}`}>
                {getBadgeLabel(item)}
              </span>
            </div>
          ))}
        {!loading && items.length === 0 && (
          <div className="empty-state">
            <p>还没有收藏任何单词或句子</p>
            <Link to="/" className="go-search">去查词</Link>
          </div>
        )}
        </div>
      </div>

      {/* ===== 中栏：抽屉（始终占位）===== */}
      <aside className="detail-drawer">
        {drawerItem ? (
          <>
            <button className="drawer-close" onClick={() => setDrawerItem(null)}>✕</button>

            {drawerItem.kind === 'word' ? (
              <>
                {/* 单词详情 */}
                <h2 className="drawer-title">{drawerItem.word}</h2>
                {(drawerItem.phonetics_uk || drawerItem.phonetics_us) && (
                  <div className="drawer-phonetic">
                    <PhoneticPlayer
                      word={drawerItem.word}
                      phoneticsUk={drawerItem.phonetics_uk}
                      phoneticsUs={drawerItem.phonetics_us}
                    />
                  </div>
                )}
                <div className="drawer-section">
                  {editing ? (
                    <div className="drawer-edit-row">
                      <textarea
                        className="drawer-edit-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit();
                          }
                          if (e.key === 'Escape') setEditing(false);
                        }}
                        autoFocus
                        rows={3}
                      />
                      <div className="drawer-edit-actions">
                        <button className="drawer-save-btn" onClick={saveEdit}>保存</button>
                        <button className="drawer-cancel-btn" onClick={() => setEditing(false)}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <WordCard
                      wordData={{
                        word: drawerItem.word,
                        definitions: drawerItem.definitions_parsed || [],
                        examples: drawerItem.examples,
                      }}
                      compact
                    />
                  )}
                </div>
                <div className="drawer-meta">
                  <span>{STAGE_LABELS[drawerItem.review_stage] ?? `阶段${drawerItem.review_stage}`}</span>
                  <span>下次: {new Date(drawerItem.next_review).toLocaleDateString('zh-CN')}</span>
                  <span>复习: {drawerItem.review_count ?? 0} 次</span>
                  <span>收藏: {new Date(drawerItem.collected_at).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="drawer-footer">
                  {!editing && (
                    <button
                      className="drawer-edit-btn"
                      onClick={() => {
                        setEditValue(drawerItem.definitions || drawerItem.definitions_summary || '');
                        setEditing(true);
                      }}
                    >
                      编辑释义
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
            ) : (
              <>
                {/* 句子详情 */}
                {/* 隐藏 audio 元素 */}
                <audio ref={sentenceAudioRef} preload="none" style={{ display: 'none' }} />

                <h2
                  className="drawer-title drawer-sentence-title"
                  onClick={() => setPhoneticTipId(phoneticTipId === drawerItem.id ? null : drawerItem.id)}
                  title="点击显示音标"
                >
                  {drawerItem.original}
                  {phoneticTipId === drawerItem.id && (() => {
                    const phonetics = parsePhonetics(drawerItem);
                    return phonetics && phonetics.length > 0 ? (
                      <div className="phonetic-bubble">
                        {phonetics.map((w, i) => (
                          <span key={i} className="phonetic-bubble-item">
                            <strong>{w.word}</strong>
                            {w.phonetics_uk && <span className="ph-uk">英 /{w.phonetics_uk}/</span>}
                            {w.phonetics_us && <span className="ph-us">美 /{w.phonetics_us}/</span>}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="phonetic-bubble phonetic-empty">暂无音标数据</div>
                    );
                  })()}
                </h2>

                {/* 朗读按钮组 */}
                <div className="sentence-drawer-actions">
                  <button
                    className={`speak-btn youdao ${sentenceSpeaking === 'youdao' ? 'speaking' : ''}`}
                    onClick={() => playSentenceTts('youdao')}
                    title="有道朗读"
                  >
                    {sentenceSpeaking === 'youdao' ? '🔊' : '🔈'} 有道
                  </button>
                  <button
                    className={`speak-btn edge ${sentenceSpeaking === 'edge' ? 'speaking' : ''}`}
                    onClick={() => playSentenceTts('edge')}
                    title="Edge TTS 朗读（神经网络语音）"
                  >
                    {sentenceSpeaking === 'edge' ? '🔊' : '🔈'} Edge
                  </button>
                </div>

                <div className="drawer-section">
                  <h3>翻译</h3>
                  {editing ? (
                    <div className="drawer-edit-row">
                      <textarea
                        className="drawer-edit-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit();
                          }
                          if (e.key === 'Escape') setEditing(false);
                        }}
                        autoFocus
                        rows={2}
                      />
                      <div className="drawer-edit-actions">
                        <button className="drawer-save-btn" onClick={saveEdit}>保存</button>
                        <button className="drawer-cancel-btn" onClick={() => setEditing(false)}>取消</button>
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
                  {!editing && (
                    <button
                      className="drawer-edit-btn"
                      onClick={() => {
                        setEditValue(drawerItem.translation || '');
                        setEditing(true);
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
          </>
        ) : (
          <div className="drawer-empty">
            <div className="drawer-empty-icon">📖</div>
            <p>单击左侧条目查看详情</p>
          </div>
        )}
      </aside>

      {/* ===== 右栏：留白 ===== */}
      <div className="wordbook-spacer"></div>

      {/* ===== 删除确认弹窗 ===== */}
      {confirmItem && (
        <div className="confirm-overlay" onClick={() => setConfirmItem(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-text">
              确定要删除 <strong>「{confirmItem.kind === 'word' ? confirmItem.word : confirmItem.original}」</strong> 吗？
            </p>
            <p className="confirm-hint">删除后不可恢复</p>
            <div className="confirm-actions">
              <button className="confirm-delete" onClick={handleDelete}>确认删除</button>
              <button className="confirm-cancel" onClick={() => setConfirmItem(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
