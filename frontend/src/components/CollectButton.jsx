import { useState } from 'react';

export default function CollectButton({ isCollected, onCollect, onRemove }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (isCollected) {
        await onRemove();
      } else {
        await onCollect();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`collect-btn ${isCollected ? 'collected' : ''}`}
      onClick={handleClick}
      disabled={loading}
      title={isCollected ? '取消收藏' : '收藏到单词本'}
    >
      {isCollected ? '★ 已收藏' : '☆ 收藏'}
    </button>
  );
}
