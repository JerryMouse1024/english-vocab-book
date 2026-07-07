"""UAPI 词典查询封装：重试、健壮解析、限流识别、备选数据源回退"""
import asyncio
import httpx
from fastapi import HTTPException

UAPI_BASE = "https://uapis.cn/api/v1/dictionary"
FREE_DICT_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en"

# 重试配置（针对瞬时错误：超时 / 5xx / 连接异常）
MAX_RETRIES = 3
BACKOFF = [0.5, 1.0, 2.0]  # 每次重试前的等待秒数


async def _request_json(client: httpx.AsyncClient, url: str, params: dict | None = None) -> dict:
    """
    发起 GET 并健壮地解析 JSON。

    任何异常（限流 / 服务器错误 / 非 JSON 响应）都转为带清晰 detail 的
    HTTPException，绝不直接抛出未处理的异常导致 500 且无 detail。
    """
    resp = await client.get(url, params=params)

    # 限流：直接抛出，不重试
    if resp.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="今日免费查询额度已用完，请稍后重试，或到 uapis.cn 注册账号获取更多额度",
        )
    # 未找到单词
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="未找到该单词的释义")
    # 服务器错误
    if resp.status_code >= 500:
        raise HTTPException(status_code=502, detail="词典服务暂时不可用（服务器错误），请稍后重试")
    # 其他非 200
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="词典服务暂时不可用，请稍后重试")

    # 检查 content-type，避免 HTML 错误页导致 resp.json() 崩溃
    ctype = resp.headers.get("content-type", "")
    if "application/json" not in ctype:
        raise HTTPException(status_code=502, detail="词典服务返回了异常格式，请稍后重试")

    try:
        return resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="词典服务返回数据解析失败，请稍后重试")


async def lookup_word(word: str) -> dict | None:
    """
    查询单词释义。

    返回标准结构 {"found": true, "entry": {...}}；
    未找到返回 None；服务异常抛出 HTTPException（带清晰 detail）。

    策略：优先 UAPI，连续失败（含限流外的瞬时错误）重试最多 3 次；
    全部失败后回退到 Free Dictionary API（完全免费、无需 Key）。
    """
    last_err: HTTPException | None = None

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                data = await _request_json(client, f"{UAPI_BASE}/lookup", {"word": word})
            if data.get("found"):
                return data
            return None  # found=false → 单词不存在
        except HTTPException as e:
            if e.status_code in (404, 429):
                raise  # 这两种情况无需重试
            last_err = e
        except (httpx.TimeoutException, httpx.ConnectError, httpx.RequestError):
            last_err = HTTPException(status_code=502, detail="网络连接超时，请检查网络后重试")

        # 退避后重试
        if attempt < MAX_RETRIES - 1:
            await asyncio.sleep(BACKOFF[attempt])

    # --- UAPI 全失败 → 回退 Free Dictionary API ---
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(f"{FREE_DICT_BASE}/{word}")
            if resp.status_code == 200 and "application/json" in resp.headers.get("content-type", ""):
                free_data = resp.json()
                return _convert_free_dict(word, free_data)
    except Exception:
        pass

    # 回退也失败，抛出最后一次 UAPI 的错误
    if last_err:
        raise last_err
    raise HTTPException(status_code=502, detail="词典服务暂时不可用，请稍后重试")


def _convert_free_dict(word: str, data: list) -> dict:
    """把 Free Dictionary API 返回转换为本项目统一的 entry 格式"""
    definitions: list[dict] = []
    examples: list[dict] = []
    phonetics_uk = phonetics_us = audio_uk = audio_us = None

    if not isinstance(data, list):
        data = [data]

    for entry in data:
        if not isinstance(entry, dict):
            continue
        if not phonetics_us and entry.get("phonetic"):
            phonetics_us = entry["phonetic"]
        for ph in entry.get("phonetics", []):
            if not isinstance(ph, dict):
                continue
            if ph.get("text") and not phonetics_us:
                phonetics_us = ph["text"]
            if ph.get("audio"):
                audio_us = audio_us or ph["audio"]
        for meaning in entry.get("meanings", []):
            if not isinstance(meaning, dict):
                continue
            pos = meaning.get("partOfSpeech", "")
            for d in meaning.get("definitions", []):
                if not isinstance(d, dict):
                    continue
                definitions.append({"part_of_speech": pos, "meaning": d.get("definition", "")})
                if d.get("example"):
                    examples.append({"source": d["example"], "translation": ""})

    return {
        "found": True,
        "entry": {
            "word": word,
            "phonetics": {
                "uk": {"text": phonetics_uk, "audio": audio_uk},
                "us": {"text": phonetics_us, "audio": audio_us},
            },
            "definitions": definitions,
            "examples": examples,
        },
    }


async def fetch_audio_url(word: str, accent: str) -> str | None:
    """获取单词发音音频 URL（优先 UAPI，失败回退 Free Dictionary）"""
    # 先试 UAPI
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            data = await _request_json(client, f"{UAPI_BASE}/lookup", {"word": word})
            if data.get("found"):
                entry = data.get("entry", data)
                ph = entry.get("phonetics", {}) or {}
                acc = ph.get(accent, {}) or {}
                url = acc.get("audio")
                if url:
                    return url if url.startswith("http") else f"https://uapis.cn{url}"
    except Exception:
        pass

    # 回退 Free Dictionary
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(f"{FREE_DICT_BASE}/{word}")
            if resp.status_code == 200:
                data = resp.json()
                for entry in data if isinstance(data, list) else [data]:
                    if not isinstance(entry, dict):
                        continue
                    for ph in entry.get("phonetics", []):
                        if isinstance(ph, dict) and ph.get("audio"):
                            return ph["audio"]
    except Exception:
        pass

    return None
