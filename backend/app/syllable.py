"""音节划分工具 — 基于 pyphen 连字符引擎。

功能：
  · 用间隔号（·）分隔音节，例如 communication → com·mu·ni·ca·tion
  · 从 IPA 音标中检测重读音节位置（通过 ˈ 符号）
  · 返回结构化数据：音节文本 + 重音索引 + 带 HTML 高亮的版本

单音节词直接返回原词。
"""
import re
import pyphen


_dic = None


def _get_dic():
    global _dic
    if _dic is None:
        _dic = pyphen.Pyphen(lang="en_US")
    return _dic


# ---- 核心 API ----

def split_syllables(word: str) -> str:
    """返回用 · 分隔的纯文本音节字符串。若无法划分则返回原词。"""
    info = get_syllable_info(word)
    return info["syllable"]


def get_syllable_info(word: str, ipa: str | None = None) -> dict:
    """
    返回完整的音节划分信息。

    参数：
        word: 单词（小写）
        ipa: 可选的 IPA 音标字符串，用于重音定位

    返回：
        {
            "syllable":       "af·ter·noon",          # 纯文本
            "syllables":      ["af", "ter", "noon"],   # 音节数组
            "stress_index":   1,                       # 重读音节的索引（0-based），无则 -1
            "syllable_html":  "<span>af</span>·<span class='stressed'>ter</span>·<span>noon</span>",
        }
    """
    if not word or not word.strip():
        return _empty()

    w = word.strip().lower()
    try:
        # inserted() 返回用连字符分隔的音节字符串，如 "af-ter-noon"
        # 比 iterate()（返回位置元组）更适合直接拆分为音节列表
        raw = _get_dic().inserted(w)
        syllables = [s for s in raw.split("-") if s]
    except Exception:
        syllables = [w]

    if not syllables:
        syllables = [w]

    # 只有一个音节 → 无需分隔
    if len(syllables) == 1:
        return {
            "syllable": w,
            "syllables": [w],
            "stress_index": -1,
            "syllable_html": f"<span>{_esc(w)}</span>",
        }

    # 拼接纯文本
    plain = "·".join(syllables)

    # 检测重音
    stress_idx = _detect_stress_index(syllables, w, ipa)

    # 构建 HTML（重读音节加 <span class="stressed">）
    html_parts = []
    for i, syl in enumerate(syllables):
        if i == stress_idx:
            html_parts.append(f"<span class='stressed'>{_esc(syl)}</span>")
        else:
            html_parts.append(f"<span>{_esc(syl)}</span>")
    html = "·".join(html_parts)

    return {
        "syllable": plain,
        "syllables": syllables,
        "stress_index": stress_idx,
        "syllable_html": html,
    }


# ---- 内部工具 ----

def _empty() -> dict:
    return {"syllable": "", "syllables": [], "stress_index": -1, "syllable_html": ""}


def _esc(s: str) -> str:
    """HTML 转义"""
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
         .replace('"', "&quot;")
    )


def _detect_stress_index(syllables: list[str], word: str, ipa: str | None) -> int:
    """
    检测重读音节索引。

    策略：
      1. 若提供 IPA 且含 ˈ → 通过元音计数映射到音节
      2. 否则回退到启发式规则（多音节词倒数第 1~2 个音节常见重音）

    返回 0-based 索引，无法确定时返回 -1。
    """
    n = len(syllables)

    # --- 方法一：IPA 主重音分析 ---
    if ipa:
        idx = _stress_from_ipa(syllables, word, ipa)
        if idx >= 0:
            return idx

    # --- 方法二：启发式 ---
    # 英语多音节词常见重音模式：
    #   2 音节：通常第 1 或第 2 个
    #   3+ 音节：通常倒数第 2 或 第 1 个
    if n == 2:
        return 0  # 常见如 after·noon, com·mu·ni·ca→tion 的子词
    if n >= 3:
        return max(0, n - 2)  # 倒数第二个
    return 0


def _stress_from_ipa(syllables: list[str], word: str, ipa: str) -> int:
    """
    通过 IPA 音标中的 ˈ（主重音）定位重读音节。

    采用「元音计数法」：统计 ˈ 之前的 IPA 元音数量，
    该数量即为重读音节之前有几个音节（即重读音节的 0-based 索引）。

    例如 communication /kəˌmjuːnɪˈkeɪʃən/：
      ˈ 之前有 ə, u, ɪ 共 3 个元音 → 重音在第 3 个音节（ca）→ idx=3 ✅
    """
    # 去掉前后 / 和括号等
    clean_ipa = re.sub(r"[/()\[\]]", "", ipa)

    # 找主重音符号位置
    primary_pos = clean_ipa.find("ˈ")
    if primary_pos == -1:
        primary_pos = clean_ipa.find("\u02c8")
    if primary_pos == -1:
        return -1

    # IPA 元音字符集（包括常见英语元音和双元音首字母）
    ipa_vowels = set("iɪeæɑɒɔʊuʌɜəaEI")

    # 统计 ˈ 之前的元音数量（双元音如 eɪ/aɪ/oʊ 的首字母已计入）
    vowel_count = 0
    i = 0
    while i < primary_pos:
        ch = clean_ipa[i]
        if ch in ipa_vowels:
            # 跳过双元音的第二个成分（如 eɪ 中的 ɪ，aʊ 中的 ʊ）
            # 也跳过长度标记 ː
            vowel_count += 1
            # 向前看：如果是双元音组合，跳过第二个字符
            if i + 1 < primary_pos and clean_ipa[i + 1] in "ɪʊə":
                i += 1
        i += 1

    # 验证合理性：元音数应 < 音节总数
    if 0 <= vowel_count < len(syllables):
        return vowel_count

    return -1
