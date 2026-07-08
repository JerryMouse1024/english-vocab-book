import { useState, useEffect, useRef } from 'react';
import { getTodayReview, completeReview } from '../api';
import WordCard from '../components/WordCard';
import PhoneticPlayer from '../components/PhoneticPlayer';
import '../styles/ReviewPage.css';

export default function ReviewPage() {
  const [tasks, setTasks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passedCount, setPassedCount] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState(null);
  const passedIds = useRef(new Set());

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTodayReview();
      setTasks(res.data.tasks);
      setTotalTasks(res.data.tasks.length);
      setPassedCount(0);
      passedIds.current = new Set();
      setCurrentIndex(0);
      setShowMeaning(false);
      setFinished(false);
    } catch (err) {
      setError('获取复习任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleResult = async (result) => {
    const task = tasks[currentIndex];
    if (!task) return;

    try {
      const res = await completeReview(task.id, result, task.kind || 'word');
      setShowMeaning(false);

      if (result === 'pass') {
        // 记住：标记为已通过，移出队列
        passedIds.current.add(task.id);
        const newPassed = passedIds.current.size;
        setPassedCount(newPassed);

        if (newPassed >= totalTasks && totalTasks > 0) {
          setFinished(true);
          return;
        }

        // 从队列中移除当前项
        const newTasks = [...tasks];
        newTasks.splice(currentIndex, 1);
        setTasks(newTasks);

        if (newTasks.length === 0) {
          // 全部通过
          setFinished(true);
        } else if (currentIndex >= newTasks.length) {
          setCurrentIndex(0);
        }
        // currentIndex 不变，下一项自动滑入
      } else {
        // 忘记：更新阶段信息，排到第 2 个单词之后（跳过 2 个才再次出现）
        const updatedTask = {
          ...task,
          stage: res.data.new_stage,
          review_count: (task.review_count || 0) + 1,
        };
        const newTasks = [...tasks];
        newTasks.splice(currentIndex, 1);
        // 插入到索引 2 的位置（前面保留 2 个单词），队列不足则排到队尾
        const insertIndex = Math.min(2, newTasks.length);
        newTasks.splice(insertIndex, 0, updatedTask);
        setTasks(newTasks);

        if (currentIndex >= newTasks.length) {
          setCurrentIndex(0);
        }
        // currentIndex 不变，下一项自动滑入
      }
    } catch (err) {
      alert('提交失败，请重试');
    }
  };

  const wordCount = tasks.filter((t) => t.kind === 'word').length;
  const sentenceCount = tasks.filter((t) => t.kind === 'sentence').length;

  if (loading) {
    return <div className="review-page"><div className="loading">加载复习任务...</div></div>;
  }

  if (error) {
    return (
      <div className="review-page">
        <div className="error-message">{error}</div>
        <button onClick={fetchTasks} className="retry-btn">重试</button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="review-page">
        <div className="review-finished">
          <div className="finished-icon">🎉</div>
          <h2>今日复习完成！</h2>
          <p>共通过 {passedCount} 项（初始 {totalTasks} 项）</p>
          <p className="finished-tip">坚持就是胜利，明天继续加油！</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="review-page">
        <div className="review-empty">
          <div className="empty-icon">✅</div>
          <h2>今天没有需要复习的内容</h2>
          <p>去查词页面收藏新单词或句子吧！</p>
        </div>
      </div>
    );
  }

  const current = tasks[currentIndex];
  const isSentence = current.kind === 'sentence';

  return (
    <div className="review-page">
      <h1>每日复习</h1>

      <div className="review-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${totalTasks > 0 ? (passedCount / totalTasks) * 100 : 0}%` }}
          />
        </div>
        <span className="progress-text">{passedCount} / {totalTasks}</span>
      </div>

      {wordCount > 0 && sentenceCount > 0 && (
        <div className="review-types">
          今日: {wordCount > 0 ? `${wordCount} 个单词` : ''}{wordCount > 0 && sentenceCount > 0 ? ' · ' : ''} {sentenceCount > 0 ? `${sentenceCount} 个句子` : ''}
        </div>
      )}

      <div className="review-card">
        <div className="review-word-display">
          <h2 className={`review-word ${isSentence ? 'sentence-word' : ''}`}>
            {isSentence ? current.original : current.word}
          </h2>
          {!isSentence && (
            <PhoneticPlayer
              word={current.word}
              phoneticsUk={current.phonetics_uk}
              phoneticsUs={current.phonetics_us}
            />
          )}
          <span className="stage-info">
            阶段 {current.stage} · 已复习 {current.review_count} 次
          </span>
        </div>

        {!showMeaning ? (
          <button
            className="show-meaning-btn"
            onClick={() => setShowMeaning(true)}
          >
            显示释义
          </button>
        ) : (
          <div className="review-meaning">
            {isSentence ? (
              <div className="review-sentence-trans">
                <p className="sentence-trans-text">{current.translation || '（无翻译）'}</p>
              </div>
            ) : (
              <WordCard
                wordData={{
                  word: current.word,
                  definitions: current.definitions,
                  examples: current.examples,
                }}
                compact
              />
            )}

            <div className="review-actions">
              <button
                className="action-btn fail-btn"
                onClick={() => handleResult('fail')}
              >
                😔 忘记了
              </button>
              <button
                className="action-btn pass-btn"
                onClick={() => handleResult('pass')}
              >
                😊 记得了
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="review-queue">
        <p>队列剩余 {tasks.length} 项 · 已通过 {passedCount} 项</p>
      </div>
    </div>
  );
}
