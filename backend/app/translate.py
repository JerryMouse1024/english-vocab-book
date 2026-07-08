"""免费翻译封装：有道翻译（主）-> MyMemory（备）

说明：
- 有道翻译网页接口，免费无需 API Key，翻译质量好
- MyMemory 公共接口作为备选降级（每日约 5000 词/天额度）
- 任何异常都返回 None，由调用方决定是否降级展示
"""
import httpx

YOUDAO_URL = "https://fanyi.youdao.com/translate"
MYMEMORY_URL = "https://api.mymemory.translated.net/get"
TIMEOUT = 8.0


async def _youdao_translate(text: str, client: httpx.AsyncClient) -> str | None:
    """有道翻译：POST 表单请求，返回 JSON"""
    try:
        resp = await client.post(
            YOUDAO_URL,
            data={"i": text, "doctype": "json", "type": "AUTO"},
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://fanyi.youdao.com/",
            },
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("errorCode") != 0:
            return None
        result = data.get("translateResult", [])
        if not result or not result[0]:
            return None
        # 合并多个翻译片段
        return "".join(seg.get("tgt", "") for seg in result[0])
    except Exception:
        return None


async def _mymemory_translate(text: str, client: httpx.AsyncClient) -> str | None:
    """MyMemory 翻译（备选降级）"""
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
    """将英文文本翻译为中文。优先有道，失败降级到 MyMemory。"""
    if not text or not text.strip():
        return None

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # ① 有道翻译（主）
        result = await _youdao_translate(text, client)
        if result:
            return result

        # ② MyMemory（备）
        result = await _mymemory_translate(text, client)
        if result:
            return result

    return None
