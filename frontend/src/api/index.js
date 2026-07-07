import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// 查词
export const lookupWord = (word) => api.get(`/word/${encodeURIComponent(word)}`);

// 收藏单词
export const collectWord = (word, note = null) =>
  api.post('/word/collect', { word, note });

// 删除收藏
export const deleteCollection = (id) => api.delete(`/word/collect/${id}`);

// 获取单词本列表
export const getWordList = (params = {}) => api.get('/words', { params });

// 获取今日复习任务
export const getTodayReview = () => api.get('/review/today');

// 完成复习
export const completeReview = (id, result, kind = 'word') =>
  api.post(`/review/complete/${id}`, { result, kind });

// 句子查词
export const querySentence = (sentence) =>
  api.post('/sentence/query', { sentence });

// 收藏��子
export const collectSentence = (original, translation = null, wordsJson = null) =>
  api.post('/sentence/collect', { original, translation, words_json: wordsJson });

// 获取收藏本中的句子列表（与单词合并展示在收藏本）
export const getSentences = () => api.get('/sentences');

// 删除收藏本中的句子
export const deleteSentence = (id) => api.delete(`/sentence/${id}`);

// 更新句子翻译
export const updateSentence = (id, translation) =>
  api.put(`/sentence/${id}`, { translation });

// 获取发音音频URL（单词词典发音）
export const getAudioUrl = (word, accent = 'us') =>
  `/api/word/${encodeURIComponent(word)}/audio/${accent}`;

// 整句朗读 TTS 音频URL（在线TTS，返回MP3流）
export const getSentenceAudioUrl = (text, lang = 'en-US') =>
  `/api/tts?${new URLSearchParams({ text, lang })}`;

export default api;
