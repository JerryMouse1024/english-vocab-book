"""整句朗读路由：代理在线 TTS 服务，返回音频流（替代不可靠的浏览器 Web Speech API）

策略：
1) 主力：Google Translate TTS（免费、无需密钥、返回 MP3）
2) 备选：如果主源失败，尝试备用 URL 格式
3) 全部失败则返回 502 + 明确错误信息。

前端用 <audio src="/api/tts?text=..." /> 播放 —— 和单词发音一样的可靠机制。
"""
import httpx
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api", tags=["tts"])

# Google Translate TTS（免费、无密钥、MP3 输出）
_TTS_URL = "https://translate.google.com/translate_tts"

# 备用 URL 参数组合（不同 client 值有时能绕过限流）
_FALLBACK_PARAMS_LIST = [
    {"ie": "UTF-8", "tl": "en-US", "client": "tw-ob"},
    {"ie": "UTF-8", "tl": "en",   "client": "gtx"},
    {"ie": "UTF-8", "tl": "en-US", "client": "webapp"},
]

# httpx 超时（TTS 生成通常很快）
_TIMEOUT = 15.0


@router.get("/tts")
async def text_to_speech(
    text: str = Query(..., description="要朗读的文本"),
    lang: str = Query("en-US", description="语言，默认 en-US"),
):
    """将文本转为音频流（MP3），前端用 <audio> 标签播放。"""
    if not text.strip():
        raise HTTPException(status_code=400, detail="text 不能为空")

    last_err = None
    for params in _FALLBACK_PARAMS_LIST:
        merged = {**params, "q": text}
        if lang:
            merged["tl"] = lang

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
                resp = await client.get(_TTS_URL, params=merged)

                # 成功获取音频数据
                if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("audio"):
                    content_type = resp.headers.get("content-type", "audio/mpeg")

                    async def stream_audio():
                        async for chunk in resp.aiter_bytes(chunk_size=8192):
                            yield chunk

                    return StreamingResponse(
                        stream_audio(),
                        media_type=content_type,
                        headers={
                            "Content-Disposition": f'inline; filename="tts.mp3"',
                        },
                    )

                # 非音频响应或非200 → 尝试下一组参数
                if resp.status_code == 429:
                    last_err = HTTPException(status_code=429, detail="TTS 服务请求过于频繁，请稍后再试")
                elif resp.status_code == 403:
                    last_err = HTTPException(status_code=502, detail="TTS 服务拒绝访问（可能被限流），请稍后再试")
                else:
                    last_err = HTTPException(
                        status_code=502,
                        detail=f"TTS 服务返回异常状态码 {resp.status_code}",
                    )
        except (httpx.TimeoutException, httpx.ConnectError, httpx.RequestError) as e:
            last_err = HTTPException(
                status_code=502,
                detail=f"TTS 服务网络异常：{str(e)}",
            )

    # 所有备选都失败了
    raise last_err or HTTPException(status_code=502, detail="TTS 服务暂时不可用，请稍后再试")
