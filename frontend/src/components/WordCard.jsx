import PhoneticPlayer from './PhoneticPlayer';
import CollectButton from './CollectButton';
import '../styles/WordCard.css';

export default function WordCard({
  wordData,
  onCollect,
  onRemove,
  compact = false,
}) {
  if (!wordData) return null;

  const {
    word,
    phonetics_uk,
    phonetics_us,
    exam_tags,
    definitions,
    english_defs,
    word_forms,
    phrases,
    synonyms,
    examples,
    is_collected,
  } = wordData;

  return (
    <div className={`word-card ${compact ? 'compact' : ''}`}>
      <div className="word-card-header">
        <h2 className="word-title">{word}</h2>
        <PhoneticPlayer
          word={word}
          phoneticsUk={phonetics_uk}
          phoneticsUs={phonetics_us}
        />
        {onCollect && (
          <CollectButton
            isCollected={is_collected || false}
            onCollect={() => onCollect(word)}
            onRemove={onRemove}
          />
        )}
      </div>

      {exam_tags && exam_tags.length > 0 && (
        <div className="exam-tags">
          {exam_tags.map((tag, i) => (
            <span key={i} className="exam-tag">{tag}</span>
          ))}
        </div>
      )}

      {definitions && definitions.length > 0 && (
        <div className="word-section">
          <h3>释义</h3>
          {definitions.map((d, i) => (
            <p key={i} className="definition-item">
              <span className="pos">{d.part_of_speech}</span> {d.meaning}
            </p>
          ))}
        </div>
      )}

      {!compact && english_defs && english_defs.length > 0 && (
        <div className="word-section">
          <h3>英英释义</h3>
          {english_defs.map((d, i) => (
            <div key={i} className="eng-def-item">
              <span className="pos">{d.part_of_speech}</span>
              <p>{d.definition}</p>
              {d.examples && d.examples.map((ex, j) => (
                <p key={j} className="eng-example">例: {ex}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {!compact && word_forms && word_forms.length > 0 && (
        <div className="word-section">
          <h3>词形变化</h3>
          <div className="word-forms">
            {word_forms.map((wf, i) => (
              <span key={i} className="word-form-item">
                {wf.name}: {wf.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {!compact && phrases && phrases.length > 0 && (
        <div className="word-section">
          <h3>常用词组</h3>
          {phrases.map((p, i) => (
            <p key={i} className="phrase-item">
              <strong>{p.phrase}</strong> — {p.meaning}
            </p>
          ))}
        </div>
      )}

      {!compact && synonyms && synonyms.length > 0 && (
        <div className="word-section">
          <h3>近义词</h3>
          {synonyms.map((s, i) => (
            <p key={i} className="synonym-item">
              <span className="pos">{s.part_of_speech}</span> {s.meaning}:{' '}
              {s.words?.join(', ')}
            </p>
          ))}
        </div>
      )}

      {examples && examples.length > 0 && (
        <div className="word-section">
          <h3>双语例句</h3>
          {examples.map((ex, i) => (
            <div key={i} className="example-item">
              <p className="example-source">{ex.source}</p>
              <p className="example-translation">{ex.translation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
