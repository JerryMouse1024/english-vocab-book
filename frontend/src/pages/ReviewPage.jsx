import { useState, useEffect } from 'react';
import { getTodayReview, completeReview } from '../api';
import WordCard from '../components/WordCard';
import PhoneticPlayer from '../components/PhoneticPlayer';
import '../styles/ReviewPage.css';

export default function ReviewPage() {
  const [tasks, setTasks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTodayReview();
      setTasks(res.data.tasks);
      setCompleted(0);
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
      await completeReview(task.id, result, task.kind || 'word');
      setCompleted((c) => c + 1);
      setShowMeaning(false);

      if (currentIndex + 1 >= tasks.length) {
        setFinished(true);
      } else {
        setCurrentIndex(currentIndex + 1);
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
          <p>共完成 {completed} 项复习</p>
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
            style={{ width: `${(completed / tasks.length) * 100}%` }}
          />
        </div>
        <span className="progress-text">{completed} / {tasks.length}</span>
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
        <p>剩余 {tasks.length - currentIndex - 1} 项</p>
      </div>
    </div>
  );
}
