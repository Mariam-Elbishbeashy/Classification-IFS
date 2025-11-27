# backend/voice_router.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile, os, asyncio
import ffmpeg
import whisper
import httpx
import ssl
ssl._create_default_https_context = ssl._create_unverified_context


voice_router = APIRouter()

# Lazy-load the model once (English-only as requested)
_model = None
def get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("base.en")  # tiny.en for speed, base.en for accuracy
    return _model

async def _save_upload_to_temp(upload: UploadFile, suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    with open(path, "wb") as f:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
    await upload.close()
    return path

def _webm_to_wav(webm_path: str) -> str:
    wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(wav_fd)
    # Convert to WAV 16kHz mono — best for STT
    (
        ffmpeg
        .input(webm_path)
        .output(wav_path, ac=1, ar=16000, format="wav")
        .overwrite_output()
        .run(quiet=True)
    )
    return wav_path

@voice_router.post("/analyze-voice")
async def analyze_voice(file: UploadFile = File(...)):
    # Basic content-type guard (browser MediaRecorder -> audio/webm)
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Please send an audio file blob (audio/webm).")

    webm_path = await _save_upload_to_temp(file, suffix=".webm")

    try:
        wav_path = _webm_to_wav(webm_path)

        # Transcribe (English only)
        model = get_model()
        result = await asyncio.to_thread(model.transcribe, wav_path, language="en")
        transcript = (result.get("text") or "").strip()

        if not transcript:
            return JSONResponse(
                {"transcript": "", "predictions": [], "message": "No speech detected."},
                status_code=200,
            )

        # Call your existing /analyze-text to reuse the exact same classifier output
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "http://127.0.0.1:8000/analyze-text",
                json={"text": transcript},
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"classifier error: {resp.text}")

        data = resp.json()
        predictions = data.get("predictions", [])

        return {"transcript": transcript, "predictions": predictions}

    finally:
        # Clean up temp files
        try:
            os.remove(webm_path)
        except Exception:
            pass
        try:
            if 'wav_path' in locals():
                os.remove(wav_path)
        except Exception:
            pass
