import { useState } from 'react';
import { getAudioUrl } from '../api';

export default function PhoneticPlayer({ word, phoneticsUk, phoneticsUs }) {
  const [playing, setPlaying] = useState(null);

  const play = (accent) => {
    setPlaying(accent);
    const audio = new Audio(getAudioUrl(word, accent));
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    audio.play().catch(() => setPlaying(null));
  };

  if (!phoneticsUk && !phoneticsUs) return null;

  return (
    <div className="phonetic-player">
      {phoneticsUk && (
        <button
          className={`phonetic-btn ${playing === 'uk' ? 'playing' : ''}`}
          onClick={() => play('uk')}
          title="英式发音"
        >
          <span className="phonetic-label">英</span>
          <span className="phonetic-text">/{phoneticsUk}/</span>
          {playing === 'uk' ? '🔊' : '🔈'}
        </button>
      )}
      {phoneticsUs && (
        <button
          className={`phonetic-btn ${playing === 'us' ? 'playing' : ''}`}
          onClick={() => play('us')}
          title="美式发音"
        >
          <span className="phonetic-label">美</span>
          <span className="phonetic-text">/{phoneticsUs}/</span>
          {playing === 'us' ? '🔊' : '🔈'}
        </button>
      )}
    </div>
  );
}
