// 整句/单词朗读封装（浏览器原生 Web Speech API）
//
// 修复"朗读没声音"的常见根因：
// 1) voices 未加载：部分浏览器首次 getVoices() 返回空，需监听 voiceschanged 预加载。
// 2) cancel 后立即 speak 丢字：Chrome 已知 bug，延迟一帧再 speak。
// 3) 引擎处于 paused 态：speak 前先 resume()。
// 4) 默认 voice 非目标语言：尽量挑选匹配语言的 voice（没有也能靠 lang 兜底）。

function loadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch (e) {
    return [];
  }
}

// 预加载 voices（首次可能为空）
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function isTTSAvailable() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

export function stopSpeaking() {
  if (isTTSAvailable()) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      /* ignore */
    }
  }
}

export function speakText(
  text,
  { lang = 'en-US', rate = 0.9, onStart, onEnd, onError } = {}
) {
  if (!text || !isTTSAvailable()) return false;
  const synth = window.speechSynthesis;

  // 解除可能的暂停态
  try {
    synth.resume();
  } catch (e) {
    /* ignore */
  }

  // 停止上一段，避免排队叠加
  try {
    synth.cancel();
  } catch (e) {
    /* ignore */
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;

  // 尽量匹配语言的 voice（例如优先 en-US / en-GB）
  const voices = loadVoices();
  const langPrefix = lang.toLowerCase().slice(0, 2);
  const match = voices.find(
    (v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix)
  );
  if (match) u.voice = match;

  if (onStart) u.onstart = onStart;
  if (onEnd) u.onend = onEnd;
  if (onError) u.onerror = onError;

  // Chrome 已知 bug：cancel 同 tick 立即 speak 会丢字，延迟一帧再播
  setTimeout(() => {
    try {
      synth.speak(u);
    } catch (e) {
      if (onError) onError();
    }
  }, 60);

  return true;
}
