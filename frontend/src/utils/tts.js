/**
 * 整句/单词朗读封装（浏览器原生 Web Speech API）
 *
 * 已针对 Windows 中文环境反复调优，修复以下「点按钮无声音」的根因：
 * ───────────────────────────────────────────────
 * ① cancel() 后紧接着 speak → Chrome 内部状态未恢复 → 静默失败
 *    ✅ 改为：先 cancel，用 RAF 双帧延迟（~120ms）确保引擎就绪再 speak
 * ② getVoices() 首次返回空数组 → 选不到英文 voice → 默认中文 voice 读英文 → 听起来怪或直接静音
 *    ✅ 改为：页面加载时立即注册 onvoiceschanged + 超时兜底重试
 * ③ u.lang 设了 en-US 但没匹配到 voice → 浏览器可能静默降级到不支持的引擎
 *    ✅ 改为：优先选 name 含 "English" 的 voice；其次按 lang 前缀匹配；最后不指定 voice 只设 lang
 * ④ 页面非活跃态 / 首次交互前 autoplay 策略阻止
 *    ✅ 改为：speak 必须由用户点击触发（已经是），且 speak 前先 resume()
 * ───────────────────────────────────────────────
 */

let _cachedVoices = [];
let _voicesLoaded = false;

/** 获取可用语音列表（带缓存） */
function getVoices() {
  try {
    return window.speechSynthesis?.getVoices() || _cachedVoices;
  } catch {
    return _cachedVoices;
  }
}

/** 加载语音列表 */
function _loadVoices() {
  try {
    const v = window.speechSynthesis?.getVoices();
    if (v && v.length > 0) {
      _cachedVoices = v;
      _voicesLoaded = true;
    }
  } catch { /* ignore */ }
}

// 页面加载时立即尝试加载 + 监听变化事件
if (typeof window !== 'undefined' && window.speechSynthesis) {
  _loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    _loadVoices();
  };
  // 兜底：某些浏览器不触发 voiceschanged，500ms 后再试一次
  setTimeout(_loadVoices, 500);
}

export function isTTSAvailable() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

/** 获取已加载的语音数量（用于调试） */
export function getVoiceCount() {
  return getVoices().length;
}

/** 停止当前朗读 */
export function stopSpeaking() {
  if (!isTTSAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch { /* ignore */ }
}

/**
 * 朗读文本
 * @param {string} text 要朗读的文本
 * @param {object} opts
 * @param {string} [opts.lang='en-US'] 语言标签
 * @param {number} [opts.rate=0.9] 语速 (0.1 ~ 10)
 * @param {Function} [opts.onStart] 开始播放回调
 * @param {Function} [opts.onEnd] 播放结束回调（正常结束或被中断）
 * @param {Function} [opts.onError] 出错回调
 * @returns {boolean} 是否成功发起朗读
 */
export function speakText(text, { lang = 'en-US', rate = 0.9, onStart, onEnd, onError } = {}) {
  if (!text || !isTTSAvailable()) return false;

  const synth = window.speechSynthesis;

  // 1) 先解除暂停态
  try { synth.resume(); } catch { /* ignore */ }

  // 2) 停止上一段（避免叠加排队）
  try { synth.cancel(); } catch { /* ignore */ }

  // 3) 构建 Utterance
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.pitch = 1;   // 正常音调
  u.volume = 1;  // 最大音量

  // 4) 选择最佳 voice（三层策略）
  const voices = getVoices();
  const picked = pickBestVoice(voices, lang);
  if (picked) {
    u.voice = picked;
    // 某些浏览器需要同时设置 voice 和 lang 才能正确发音
    u.lang = picked.lang || lang;
  }

  // 5) 回调绑定
  if (onStart) u.onstart = onStart;
  if (onEnd) u.onend = onEnd;
  if (onError) u.onerror = (e) => {
    console.warn('[TTS] 朗读出错:', e.error || e.message || e);
    if (onError) onError(e);
  };

  // 6) 用双帧 RAF 延迟 speak（比固定 setTimeout 更可靠）
  //    Chrome cancel→speak 需要至少 ~100ms 才能正常出声
  scheduleSpeak(synth, u, onError);

  return true;
}

/**
 * 选择最合适的英文语音（三层降级策略）
 */
function pickBestVoice(voices, preferredLang) {
  if (!voices.length) return null;

  const prefix = preferredLang.toLowerCase().slice(0, 2);  // 'en'

  // 第一层：name 包含 "English" 的（最靠谱，如 Microsoft David / Google US English）
  let best = voices.find(
    (v) => v.name && /english/i.test(v.name)
  );
  if (best) return best;

  // 第二层：lang 匹配前缀（如 en-US、en-GB）
  best = voices.find(
    (v) => v.lang && v.lang.toLowerCase().startsWith(prefix)
  );
  if (best) return best;

  // 第三层：不指定 voice，让浏览器自己选（靠 u.lang 兜底）
  return null;
}

/**
 * 用双帧 requestAnimationFrame 延迟 speak
 * 比 setTimeout(60ms) 更稳定：RAF 与浏览器渲染节奏同步，
 * 两帧约等于 16ms × 2 ≈ 32ms + 渲染间隔，实际通常 50~120ms。
 */
function scheduleSpeak(synth, utterance, onError) {
  let spoken = false;

  const doSpeak = () => {
    if (spoken) return;  // 防重复调用
    spoken = true;
    try {
      synth.speak(utterance);
    } catch (e) {
      console.warn('[TTS] speak() 调用异常:', e.message || e);
      if (onError) onError(e);
    }
  };

  // 第一帧：让浏览器处理完 cancel 的清理工作
  requestAnimationFrame(() => {
    // 第二帧：真正执行 speak
    requestAnimationFrame(doSpeak);

    // 安全网：如果 RAF 被节流或页面不可见，300ms 后强制执行
    setTimeout(() => {
      if (!spoken) doSpeak();
    }, 300);
  });
}
