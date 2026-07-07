export default function SearchBar({ value, onChange, onSearch, placeholder }) {
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
          placeholder={placeholder || '输入英文单词、短语或句子...'}
        />
        <button className="search-btn" onClick={onSearch}>
          查询
        </button>
      </div>
    </div>
  );
}
