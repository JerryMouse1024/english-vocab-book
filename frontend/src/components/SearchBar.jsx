export default function SearchBar({ value, onChange, onSearch, placeholder, mode, onModeChange }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '输入英文单词或句子...'}
        />
        <button className="search-btn" onClick={onSearch}>
          查询
        </button>
      </div>
      {onModeChange && (
        <div className="search-mode">
          <button
            className={`mode-btn ${mode === 'word' ? 'active' : ''}`}
            onClick={() => onModeChange('word')}
          >
            单词
          </button>
          <button
            className={`mode-btn ${mode === 'sentence' ? 'active' : ''}`}
            onClick={() => onModeChange('sentence')}
          >
            句子
          </button>
        </div>
      )}
    </div>
  );
}
