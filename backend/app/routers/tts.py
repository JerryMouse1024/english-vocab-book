"""整句朗读路由：代理在线 TTS 服务，返回音频流

降级链（全自动）：
1) 有道词典 TTS    —— 国内首选，HTTP，响应最快
2) Edge-TTS         —— 微软神经网络语音，音质最佳，国内可用（WebSocket）
3) Google TTS       —— 国外备选，需翻墙
4) 全部失败 → 502  → 前端自动降级到浏览器 SpeechSynthesis

前端用 <audio src="/api/tts?text=..." /> 播放。
"""
import edge_tts
import httpx
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api", tags=["tts"])

# === TTS 服务商配置 ===

# 有道词典发音（国内可访问，免费，无需密钥）
_YOUDAO_URL = "https://dict.youdao.com/dictvoice"

# Edge-TTS 语音映射
_EDGE_VOICES = {
    "en-US": "en-US-AriaNeural",
    "en-GB": "en-GB-SoniaNeural",
}

# Google Translate TTS（国外备用）
_GOOGLE_URL = "https://translate.google.com/translate_tts"
_GOOGLE_PARAMS = [
    {"ie": "UTF-8", "tl": "en-US", "client": "tw-ob"},
    {"ie": "UTF-8", "tl": "en",   "client": "gtx"},
]

_TIMEOUT = 15.0


async def _tts_edge(text: str, lang: str) -> bytes | None:
    """Edge-TTS：微软神经网络语音，音质最佳，WebSocket 通信。"""
    voice = _EDGE_VOICES.get(lang, "en-US-AriaNeural")
    data = b""
    try:
        communicate = edge_tts.Communicate(text, voice)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                data += chunk["data"]
        return data if data else None
    except Exception:
        return None


async def _tts_http(client: httpx.AsyncClient, url: str, params: dict) -> bytes | None:
    """HTTP TTS：有道 / Google，直接返回 MP3。"""
    try:
        resp = await client.get(url, params=params)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("audio"):
            return await resp.aread()
    except (httpx.TimeoutException, httpx.ConnectError, httpx.RequestError):
        pass
    return None


@router.get("/tts")
async def text_to_speech(
    text: str = Query(..., description="要朗读的文本"),
    lang: str = Query("en-US", description="语言，默认 en-US（美式）"),
    source: str = Query("auto", description="强制指定 TTS 服务商：youdao | edge | google | auto（默认自动降级）"),
):
    """将文本转为音频流（MP3），前端用 <audio> 标签播放。"""
    if not text.strip():
        raise HTTPException(status_code=400, detail="text 不能为空")

    # 有道: en-US → type=1（美式），其他 → type=0（英式）
    youdao_type = 1 if lang == "en-US" else 0

    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
        # ① 有道词典 TTS
        if source in ("auto", "youdao"):
            audio = await _tts_http(client, _YOUDAO_URL, {"audio": text, "type": str(youdao_type)})
            if audio:
                return _audio_response(audio)
            if source == "youdao":
                raise HTTPException(status_code=502, detail="有道 TTS 服务暂时不可用")

        # ② Edge-TTS（微软神经网络）
        if source in ("auto", "edge"):
            audio = await _tts_edge(text, lang)
            if audio:
                return _audio_response(audio)
            if source == "edge":
                raise HTTPException(status_code=502, detail="Edge-TTS 服务暂时不可用")

        # ③ Google Translate TTS
        if source in ("auto", "google"):
            for gp in _GOOGLE_PARAMS:
                merged = {**gp, "q": text}
                if lang:
                    merged["tl"] = lang
                audio = await _tts_http(client, _GOOGLE_URL, merged)
                if audio:
                    return _audio_response(audio)
            if source == "google":
                raise HTTPException(status_code=502, detail="Google TTS 服务暂时不可用")

    # 全部失败 → 前端降级到浏览器 SpeechSynthesis
    raise HTTPException(status_code=502, detail="TTS 服务暂时不可用，请稍后重试")


def _audio_response(data: bytes) -> StreamingResponse:
    """封装音频数据为流式响应。"""

    async def stream():
        yield data

    return StreamingResponse(
        stream(),
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'inline; filename="tts.mp3"'},
    )
