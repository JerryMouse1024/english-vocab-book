"""翻译封装：有道智云（主）→ 百度（辅）→ MyMemory（兜底）

降级链：
  ① 有道智云 API    — 若有 YOUDAO_APP_KEY / YOUDAO_APP_SECRET 环境变量
  ② 百度翻译 sug     — 免费，短语翻译质量好
  ③ MyMemory         — 免费，长句整句兜底

任何异常都返回 None，由调用方决定是否降级展示。
"""
import hashlib
import os
import random
import time
import httpx

YOUDAO_API_URL = "https://openapi.youdao.com/api"
BAIDU_SUG_URL = "https://fanyi.baidu.com/sug"
MYMEMORY_URL = "https://api.mymemory.translated.net/get"
TIMEOUT = 8.0


async def _youdao_api_translate(text: str, client: httpx.AsyncClient) -> str | None:
    """有道智云官方 API：需设置环境变量 YOUDAO_APP_KEY 和 YOUDAO_APP_SECRET。

    API v3 签名规则：
        sign = sha256(appKey + truncate(q) + salt + curtime + appSecret)
        其中 truncate(q)：若 len(q) > 20 则取前10 + 长度 + 后10 个字符
    """
    app_key = os.environ.get("YOUDAO_APP_KEY", "").strip()
    app_secret = os.environ.get("YOUDAO_APP_SECRET", "").strip()
    if not app_key or not app_secret:
        return None

    salt = str(random.randint(10000, 99999))
    curtime = str(int(time.time()))
    q = text.strip()

    # truncate: 超过20字符时取前10+长度+后10
    if len(q) > 20:
        truncate_q = q[:10] + str(len(q)) + q[-10:]
    else:
        truncate_q = q

    sign_input = app_key + truncate_q + salt + curtime + app_secret
    sign = hashlib.sha256(sign_input.encode("utf-8")).hexdigest()

    try:
        resp = await client.post(
            YOUDAO_API_URL,
            data={
                "q": q,
                "from": "en",
                "to": "zh-CHS",
                "appKey": app_key,
                "salt": salt,
                "sign": sign,
                "signType": "v3",
                "curtime": curtime,
            },
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("errorCode") != "0":
            return None
        return data.get("translation", [None])[0]
    except Exception:
        return None


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
    """将英文文本翻译为中文。优先有道 API，失败依次降级。"""
    if not text or not text.strip():
        return None

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # ① 有道智云 API（若已配置密钥）
        result = await _youdao_api_translate(text, client)
        if result:
            return result

        # ② 百度翻译 sug（免费）
        result = await _baidu_translate(text, client)
        if result:
            return result

        # ③ MyMemory（长句兜底）
        result = await _mymemory_translate(text, client)
        if result:
            return result

    return None
