"""免费翻译封装：百度翻译（主）-> MyMemory（备）

说明：
- 百度翻译 sug 接口，免费无需 API Key，短语翻译质量好
- MyMemory 公共接口作为备选降级（适合长句整句翻译）
- 任何异常都返回 None，由调用方决定是否降级展示
"""
import httpx

BAIDU_SUG_URL = "https://fanyi.baidu.com/sug"
MYMEMORY_URL = "https://api.mymemory.translated.net/get"
TIMEOUT = 8.0


async def _baidu_translate(text: str, client: httpx.AsyncClient) -> str | None:
    """百度翻译 sug 接口：免费、无需密钥，短语翻译质量好。"""
    try:
        resp = await client.post(
            BAIDU_SUG_URL,
            data={"kw": text.strip()},
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://fanyi.baidu.com/",
            },
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("errno") != 0:
            return None
        results = data.get("data", [])
        if not results:
            return None
        # 返回第一个匹配结果的释义（可能包含多个语义，取第一个）
        first = results[0]
        return first.get("v") or None
    except Exception:
        return None


async def _mymemory_translate(text: str, client: httpx.AsyncClient) -> str | None:
    """MyMemory 翻译（备选降级，适合长句）"""
    try:
        resp = await client.get(
            MYMEMORY_URL,
            params={"q": text, "langpair": "en|zh-CN"},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if str(data.get("responseStatus")) != "200":
            return None
        translated = (data.get("responseData") or {}).get("translatedText")
        if not translated:
            return None
        if "MYMEMORY WARNING" in translated.upper():
            return None
        return translated
    except Exception:
        return None


async def translate_en_to_zh(text: str) -> str | None:
    """将英文文本翻译为中文。优先百度 sug，失败降级到 MyMemory。"""
    if not text or not text.strip():
        return None

    # 短文本/短语的翻译首选百度 sug（质量更好）
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        result = await _baidu_translate(text, client)
        if result:
            return result

        # 长句/短语无结果时降级到 MyMemory
        result = await _mymemory_translate(text, client)
        if result:
            return result

    return None
