"""免费翻译封装：MyMemory（英文 -> 中文，无需密钥）

说明：
- MyMemory 公共接口免费、无需 API Key，适合个人使用，但有每日额度（约 5000 词/天）。
- 仅用于句子/短语的整句翻译；单词释义仍由词典接口（UAPI）提供。
- 任何异常（网络/额度用尽）都返回 None，由调用方决定是否降级展示。
"""
import httpx

MYMEMORY_URL = "https://api.mymemory.translated.net/get"
# 控制超时，避免翻译服务不可达时拖垮整句查询
TIMEOUT = 8.0


async def translate_en_to_zh(text: str) -> str | None:
    """将英文文本翻译为中文。失败返回 None。"""
    if not text or not text.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                MYMEMORY_URL,
                params={"q": text, "langpair": "en|zh-CN"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            # responseStatus 可能为 int 或 str
            if str(data.get("responseStatus")) != "200":
                return None
            translated = (data.get("responseData") or {}).get("translatedText")
            if not translated:
                return None
            # 额度用尽时 MyMemory 会在译文里塞警告文本，需剔除
            if "MYMEMORY WARNING" in translated.upper():
                return None
            return translated
    except Exception:
        # 网络异常、解析失败等一律降级
        return None
