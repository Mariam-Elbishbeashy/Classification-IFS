# backend/video_router.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os
import tempfile
import asyncio
import ssl
import csv
from pathlib import Path

import ffmpeg
import cv2 as cv
import numpy as np
import whisper
import httpx
import mediapipe as mp

# ---- trust self-signed certs (to match voice_router workaround) ----
ssl._create_default_https_context = ssl._create_unverified_context

video_router = APIRouter()

# ===================== PATHS (anchored to backend/ package) =====================
BASE_DIR = Path(__file__).resolve().parent  # .../ana-landing/backend

# Your structure exactly as you showed, but robust to cwd:
FACE_PROTO = str(BASE_DIR / "vision_models" / "face_detection" / "deploy.prototxt")
FACE_CAFFE = str(BASE_DIR / "vision_models" / "face_detection" / "res10_300x300_ssd_iter_140000.caffemodel")
EMO_MODEL  = str(BASE_DIR / "vision_models" / "emotion_model" / "model_file_30epochs.h5")

KP_LABELS  = str(BASE_DIR / "gesture_models" / "keypoint_classifier" / "keypoint_classifier_label.csv")
PH_LABELS  = str(BASE_DIR / "gesture_models" / "point_history_classifier" / "point_history_classifier_label.csv")

# Gesture classifiers (your .py files)
from .gesture_models.keypoint_classifier.keypoint_classifier import KeyPointClassifier
from .gesture_models.point_history_classifier.point_history_classifier import PointHistoryClassifier

# ===================== Lazy singletons =====================
_whisper_model = None
_face_net = None
_emotion_model = None
_kp_classifier = None
_ph_classifier = None
_kp_labels = None
_ph_labels = None

def _lazy_whisper():
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = whisper.load_model("base.en")
    return _whisper_model

def _lazy_face_net():
    global _face_net
    if _face_net is None:
        if not (os.path.exists(FACE_PROTO) and os.path.exists(FACE_CAFFE)):
            raise RuntimeError(
                f"Face detector files not found.\nExpected:\n- {FACE_PROTO}\n- {FACE_CAFFE}"
            )
        _face_net = cv.dnn.readNetFromCaffe(FACE_PROTO, FACE_CAFFE)
    return _face_net

def _lazy_emotion():
    global _emotion_model
    if _emotion_model is None:
        from keras.models import load_model
        if not os.path.exists(EMO_MODEL):
            raise RuntimeError(f"Emotion model file not found: {EMO_MODEL}")
        _emotion_model = load_model(EMO_MODEL)
    return _emotion_model

def _lazy_gestures():
    global _kp_classifier, _ph_classifier, _kp_labels, _ph_labels
    if _kp_classifier is None:
        _kp_classifier = KeyPointClassifier(
            model_path=str(BASE_DIR / "gesture_models" / "keypoint_classifier" / "keypoint_classifier.tflite")
        )
    if _ph_classifier is None:
        _ph_classifier = PointHistoryClassifier(
            model_path=str(BASE_DIR / "gesture_models" / "point_history_classifier" / "point_history_classifier.tflite")
        )
    if _kp_labels is None:
        with open(KP_LABELS, encoding="utf-8-sig") as f:
            _kp_labels = [row[0] for row in csv.reader(f)]
    if _ph_labels is None:
        with open(PH_LABELS, encoding="utf-8-sig") as f:
            _ph_labels = [row[0] for row in csv.reader(f)]
    return _kp_classifier, _ph_classifier, _kp_labels, _ph_labels

# Emotion label mapping from your training
EMO_LABELS = {
    0: "Angry",
    2: "Fear",
    3: "Happy",
    4: "Neutral",
    5: "Sad",
    6: "Surprise",
}

# ===================== Helpers =====================
async def _save_temp(upload: UploadFile, suffix: str) -> str:
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

def _extract_audio_to_wav(video_path: str) -> str:
    wav_fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(wav_fd)
    (
        ffmpeg
        .input(video_path)
        .output(wav_path, ac=1, ar=16000, format="wav")
        .overwrite_output()
        .run(quiet=True)
    )
    return wav_path

def _sample_frames_for_analysis(video_path: str, sample_every_n_frames: int = 12, max_samples: int = 60):
    cap = cv.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    frames = []
    total = 0
    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % sample_every_n_frames == 0:
            frames.append(frame)
            total += 1
            if total >= max_samples:
                break
        idx += 1
    cap.release()
    return frames

def _detect_emotions(frames):
    """Return (dominant_emotion: str, counts: dict[str,int])"""
    if not frames:
        return "Neutral", {}

    face_net = _lazy_face_net()
    emo_model = _lazy_emotion()
    counts: dict[str, int] = {}

    for frame in frames:
        h, w = frame.shape[:2]
        blob = cv.dnn.blobFromImage(
            cv.resize(frame, (300, 300)),
            1.0, (300, 300),
            (104.0, 177.0, 123.0),
            swapRB=False, crop=False
        )
        face_net.setInput(blob)
        detections = face_net.forward()

        best = None
        best_conf = 0.0

        for i in range(detections.shape[2]):
            conf = float(detections[0, 0, i, 2])
            if conf < 0.85:
                continue
            x1, y1, x2, y2 = (detections[0, 0, i, 3:7] * np.array([w, h, w, h])).astype("int")
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)
            if (x2 - x1) < 50 or (y2 - y1) < 50:
                continue
            if conf > best_conf:
                best = (x1, y1, x2, y2)
                best_conf = conf

        if best is None:
            continue

        x1, y1, x2, y2 = best
        gray = cv.cvtColor(frame, cv.COLOR_BGR2GRAY)
        face = gray[y1:y2, x1:x2]
        if face.size == 0:
            continue
        face_resized = cv.resize(face, (48, 48))
        face_norm = face_resized / 255.0
        face_in = np.reshape(face_norm, (1, 48, 48, 1))
        pred = emo_model.predict(face_in, verbose=0)
        label_idx = int(np.argmax(pred, axis=1)[0])
        label = EMO_LABELS.get(label_idx, "Neutral")
        counts[label] = counts.get(label, 0) + 1

    if not counts:
        return "Neutral", {}
    dominant = sorted(counts.items(), key=lambda x: x[1], reverse=True)[0][0]
    return dominant, counts

def _detect_gestures(frames):
    """
    Return (dominant_gesture: str|None, counts: dict[str,int])
    Uses only keypoint classifier for a simple, stable label.
    """
    if not frames:
        return None, {}

    kp, ph, kp_labels, ph_labels = _lazy_gestures()
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.5
    )

    counts: dict[str, int] = {}
    try:
        for frame in frames:
            image_rgb = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
            res = hands.process(image_rgb)
            if not res.multi_hand_landmarks:
                continue

            for lm in res.multi_hand_landmarks:
                # Build keypoint feature vector (wrist-relative, normalized)
                image_h, image_w = frame.shape[0], frame.shape[1]
                points = []
                for p in lm.landmark:
                    x = min(int(p.x * image_w), image_w - 1)
                    y = min(int(p.y * image_h), image_h - 1)
                    points.append([x, y])

                base_x, base_y = points[0]
                norm = []
                for x, y in points:
                    norm.extend([x - base_x, y - base_y])
                max_val = max(1, max(map(abs, norm)))
                norm = [n / max_val for n in norm]

                kp_id = kp(norm)
                if isinstance(kp_id, (list, tuple, np.ndarray)):
                    kp_id = int(kp_id[0])
                try:
                    label = kp_labels[int(kp_id)]
                except Exception:
                    label = None

                if label:
                    counts[label] = counts.get(label, 0) + 1
    finally:
        hands.close()

    if not counts:
        return None, {}
    dominant = sorted(counts.items(), key=lambda x: x[1], reverse=True)[0][0]
    return dominant, counts

# ===================== Endpoint =====================
@video_router.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    # Accept videos (webm/mp4/mov) and generic octet-stream
    if not file.content_type or not file.content_type.startswith(("video/", "application/octet-stream")):
        raise HTTPException(status_code=400, detail="Please upload a video file (webm/mp4/mov).")

    # Save temp upload
    # Use .webm suffix by default; RecordRTC/iOS can still pass mp4/mov content.
    video_path = await _save_temp(file, suffix=".webm")
    wav_path = None
    try:
        # 1) Audio -> Whisper transcription
        wav_path = _extract_audio_to_wav(video_path)
        model = _lazy_whisper()
        result = await asyncio.to_thread(model.transcribe, wav_path, language="en")
        transcript = (result.get("text") or "").trim() if hasattr(str, "trim") else (result.get("text") or "").strip()

        # 2) Speech sanity: if too short, early return with message (frontend shows nicely)
        if len(transcript.split()) < 2:
            return JSONResponse(
                {
                    "transcript": transcript,
                    "predictions": [],
                    "vision": {
                        "dominant_emotion": "Neutral",
                        "dominant_gesture": None,
                        "emotions": {},
                        "gestures": {},
                    },
                    "message": "Please speak more so I can understand you better.",
                },
                status_code=200,
            )

        # 3) Call your text classifier (keep outputs identical to /analyze-text)
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "http://127.0.0.1:8000/analyze-text",
                json={"text": transcript},
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"classifier error: {resp.text}")
        predictions = resp.json().get("predictions", [])

        # 4) Sample frames from the video for vision analysis
        frames = _sample_frames_for_analysis(video_path)

        # 5) Emotion + gesture (return dominant + dictionaries)
        dominant_emotion, emo_counts = _detect_emotions(frames)
        dominant_gesture, gest_counts = _detect_gestures(frames)

        # 6) Shape response for the frontend
        return {
            "transcript": transcript,
            "predictions": predictions,  # [{ label, confidence }]
            "vision": {
                "dominant_emotion": dominant_emotion,
                "dominant_gesture": dominant_gesture,
                "emotions": emo_counts,   # { "Happy": 12, ... }
                "gestures": gest_counts,  # { "Open": 8, ... }
            },
        }

    finally:
        # cleanup
        try:
            os.remove(video_path)
        except Exception:
            pass
        if wav_path:
            try:
                os.remove(wav_path)
            except Exception:
                pass