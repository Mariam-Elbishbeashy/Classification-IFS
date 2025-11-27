"use client"

import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Mic, Video, Sparkles, Heart, Shield, User, RotateCcw } from "lucide-react"
import Link from "next/link"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"

// We’ll import RecordRTC dynamically (SSR-safe)
const loadRecordRTC = async () => (await import("recordrtc")).default || (await import("recordrtc"))

type InputMode = "text" | "voice" | "video" | null
type ApiPrediction = { label: string; confidence: number }

function MapTerrain() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.1
    }
  })

  const geometry = new THREE.PlaneGeometry(6, 6, 32, 32)
  const positions = geometry.attributes.position.array as Float32Array

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    positions[i + 2] = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.8 + Math.sin(x * 1.2 + y * 1.2) * 0.3
  }

  geometry.computeVertexNormals()

  return (
    <group rotation={[-Math.PI / 3, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#8b5cf6"
          wireframe
          transparent
          opacity={0.6}
          emissive="#8b5cf6"
          emissiveIntensity={0.2}
        />
      </mesh>
      {[
        [1, 1, 0.5],
        [-1.5, 0.5, 0.3],
        [0.5, -1.5, 0.4],
        [-0.8, -0.8, 0.6],
        [2, -1, 0.3],
      ].map((pos, i) => (
        <mesh key={i} position={[pos[0], pos[1], pos[2]]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#ec4899" : "#06b6d4"}
            emissive={i % 2 === 0 ? "#ec4899" : "#06b6d4"}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  )
}

const inputModes = [
  {
    id: "text" as const,
    icon: MessageSquare,
    title: "Text Input",
    description: "Write about what's on your mind.",
  },
  {
    id: "voice" as const,
    icon: Mic,
    title: "Voice Input",
    description: "Speak freely and express your feelings.",
  },
  {
    id: "video" as const,
    icon: Video,
    title: "Video Input",
    description: "Let ANA see your emotions.",
  },
]

// ——— Category mapping (no emojis; icons only) ———
function getCategory(label: string): "protective" | "self_led" | "unknown" {
  const key = label.toLowerCase().replace(/\s+/g, "_")
  const protective = new Set([
    "inner_critic",
    "perfectionist",
    "protector",
    "avoidant_part",
    "blamer",
    "controller",
    "fearful_part",
    "procrastinator",
    "victimized_part",
    "addictive_part",
  ])
  const selfLed = new Set([
    "healer",
    "nurturer",
    "reassurer",
    "sage",
    "seeker",
    "self_presence",
    "warrior",
    "wounded_child",
  ])
  if (protective.has(key)) return "protective"
  if (selfLed.has(key)) return "self_led"
  return "unknown"
}

function CategoryBadge({ category }: { category: "protective" | "self_led" | "unknown" }) {
  const Icon = category === "protective" ? Shield : category === "self_led" ? Heart : User
  const label = category === "protective" ? "Protective" : category === "self_led" ? "Self-Led" : "Unknown"
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full border border-border/60">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

// Fallback colors by category
function colorForCategory(category: "protective" | "self_led" | "unknown") {
  if (category === "protective") return "from-purple-400 to-indigo-500"
  if (category === "self_led") return "from-pink-400 to-rose-500"
  return "from-blue-400 to-cyan-500"
}

// Icon chooser by label (defaults to User)
function iconForLabel(label: string) {
  const key = label.toLowerCase()
  if (key.includes("critic") || key.includes("perfectionist")) return User
  if (key.includes("protect")) return Shield
  if (key.includes("nurtur") || key.includes("heal") || key.includes("reassur") || key.includes("wounded")) return Heart
  return User
}

export default function CheckInPage() {
  const [selectedMode, setSelectedMode] = useState<InputMode>(null)
  const [textInput, setTextInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState<string>("")
  const [isVideoRecording, setIsVideoRecording] = useState(false)


  // Real predictions from backend
  const [predictions, setPredictions] = useState<ApiPrediction[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // --- Voice (existing) ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [supportsWebm, setSupportsWebm] = useState<boolean>(true)

  // --- Video recording (RecordRTC) ---
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const liveStreamRef = useRef<MediaStream | null>(null)
  const recordrtcRef = useRef<any>(null) // RecordRTC instance
  const [hasRecordedClip, setHasRecordedClip] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [visionSummary, setVisionSummary] = useState<{
    dominant_emotion?: string
    dominant_gesture?: string | null
    emotions?: Record<string, number>
    gestures?: Record<string, number>
  } | null>(null)

  useEffect(() => {
    // Check MIME support once (for voice blob)
    const mime = "audio/webm"
    if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported?.(mime)) {
      setSupportsWebm(false)
    }
  }, [])

  const resetResults = () => {
    setPredictions(null)
    setTranscript("")
    setShowResults(false)
    setError(null)
    setVisionSummary(null)
  }

  // -------- Voice Recording (existing) ----------
  const startRecording = async () => {
    try {
      resetResults()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = supportsWebm ? "audio/webm" : ""
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      rec.onstop = async () => {
        // Stop tracks
        stream.getTracks().forEach((t) => t.stop())
        // Build blob and send to backend
        const blob = new Blob(chunksRef.current, { type: supportsWebm ? "audio/webm" : "application/octet-stream" })
        await sendVoiceForAnalysis(blob)
      }

      mediaRecorderRef.current = rec
      rec.start()
      setIsRecording(true)
    } catch (err: any) {
      setError("Microphone permission denied or unavailable.")
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  const sendVoiceForAnalysis = async (blob: Blob) => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", blob, "recording.webm")
      const res = await fetch("http://127.0.0.1:8000/analyze-voice", {
        method: "POST",
        body: form,
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Voice analysis failed")
      }
      const data = (await res.json()) as { transcript?: string; predictions?: ApiPrediction[] }
      const list = Array.isArray(data?.predictions) ? data.predictions : []
      const cleanTranscript = (data?.transcript || "").trim()
      setTranscript(cleanTranscript)

      // ✅ Validate speech length
      const wordCount = cleanTranscript ? cleanTranscript.split(/\s+/).length : 0
      if (!cleanTranscript || wordCount < 2) {
        setError("Please speak more so I can understand you better.")
        setPredictions(null)
        setShowResults(true)
        setIsAnalyzing(false)
        return
      }

      setPredictions(list.slice(0, 3))
      setShowResults(true)
    } catch (e: any) {
      setError(e?.message || "Something went wrong while analyzing voice.")
      setPredictions(null)
      setShowResults(true)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // -------- Video capture + recording (Safari-friendly via RecordRTC) ----------
  const startVideoPreview = async () => {
    // Start camera preview without recording yet
    try {
      resetResults()
      // Prefer front camera on phones
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      liveStreamRef.current = stream
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.muted = true
        await videoPreviewRef.current.play()
      }
      setIsVideoReady(true)
    } catch (e: any) {
      setError("Camera/mic permission denied or unavailable.")
      setIsVideoReady(false)
    }
  }

  const startVideoRecording = async () => {
    try {
      setError(null)
      if (!liveStreamRef.current) {
        await startVideoPreview()
      }
      const RecordRTC = await loadRecordRTC()
      // Try a Safari-friendly container. RecordRTC handles fallbacks internally.
      // We’ll prefer WebM; on iOS it may produce .mov or .mp4 in practice.
      const recorder = new RecordRTC(liveStreamRef.current!, {
        type: "video",
        mimeType: "video/webm;codecs=vp8", // fallback handled by RecordRTC if unsupported
        disableLogs: true,
        timeSlice: 0,
      })
      recordrtcRef.current = recorder
      recorder.startRecording()
      setHasRecordedClip(null)
    } catch (e: any) {
      setError("Could not start recording on this browser.")
    }
  }

  const stopVideoRecording = async () => {
    try {
      const recorder = recordrtcRef.current
      if (!recorder) return
      await new Promise<void>((resolve, reject) => {
        recorder.stopRecording(() => resolve())
      })
      const blob: Blob = recorder.getBlob()
      // Stop preview tracks (freeze last frame on iOS Safari otherwise)
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach((t) => t.stop())
        liveStreamRef.current = null
      }
      // Show playback
      const url = URL.createObjectURL(blob)
      setRecordedUrl(url)
      setHasRecordedClip(blob)
      setIsVideoReady(false)
      // Attach blob for playback
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null
        videoPreviewRef.current.src = url
        await videoPreviewRef.current.play().catch(() => {})
      }
    } catch (e: any) {
      setError("Failed to stop recording.")
    } finally {
      recordrtcRef.current = null
    }
  }

  const retryVideo = async () => {
    try {
      // Revoke previous blob URL
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    } catch {}
    setRecordedUrl(null)
    setHasRecordedClip(null)
    setVisionSummary(null)
    await startVideoPreview()
  }

  const sendVideoForAnalysis = async (blob: Blob) => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const form = new FormData()
      // pick an extension that backend can handle; RecordRTC blob.type may vary
      const ext = blob.type.includes("mp4")
        ? "mp4"
        : blob.type.includes("quicktime")
          ? "mov"
          : "webm"
      form.append("file", blob, `checkin.${ext}`)

      const res = await fetch("http://127.0.0.1:8000/analyze-video", {
        method: "POST",
        body: form,
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Video analysis failed")
      }
      const data = await res.json()
      const cleanTranscript = (data?.transcript || "").trim()
      setTranscript(cleanTranscript)

      // text predictions
      const list: ApiPrediction[] = Array.isArray(data?.predictions) ? data.predictions : []
      // if we received 0/1 word speech, backend already enforced the message
      if (!cleanTranscript || cleanTranscript.split(/\s+/).length < 2) {
        setError(data?.message || "Please speak more so I can understand you better.")
        setPredictions(null)
      } else {
        setPredictions(list.slice(0, 3))
      }

      // vision summary (emotions/gestures)
      setVisionSummary({
        dominant_emotion: data?.vision?.dominant_emotion,
        dominant_gesture: data?.vision?.dominant_gesture,
        emotions: data?.vision?.emotions || {},
        gestures: data?.vision?.gestures || {},
      })

      setShowResults(true)
    } catch (e: any) {
      setError(e?.message || "Something went wrong while analyzing the video.")
      setPredictions(null)
      setShowResults(true)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAnalyze = async () => {
    if (selectedMode === "text") {
      if (!textInput.trim()) return
      setIsAnalyzing(true)
      setError(null)
      try {
        const res = await fetch("http://127.0.0.1:8000/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textInput.trim() }),
        })
        if (!res.ok) {
          const msg = await res.text()
          throw new Error(msg || "Request failed")
        }
        const data = (await res.json()) as { predictions?: ApiPrediction[] }
        const list = Array.isArray(data?.predictions) ? data.predictions : []
        setPredictions(list.slice(0, 3))
      } catch (e: any) {
        setError(e?.message || "Something went wrong while analyzing.")
        setPredictions(null)
      } finally {
        setIsAnalyzing(false)
        setShowResults(true)
      }
    } else if (selectedMode === "voice") {
      // Do nothing; voice flow posts when recording stops
      setShowResults(true)
    } else if (selectedMode === "video") {
      if (hasRecordedClip) {
        await sendVideoForAnalysis(hasRecordedClip)
      } else {
        setError("Please record a short clip first.")
      }
    } else {
      // no-op
    }
  }

  // Build cards content:
  const resultCards =
    predictions && predictions.length > 0
      ? predictions.map((p) => {
          const category = getCategory(p.label)
          const Icon = iconForLabel(p.label)
          return {
            name: p.label,
            icon: Icon,
            summary: `${p.label} — confidence ${(p.confidence * 100).toFixed(1)}%`,
            color: colorForCategory(category),
            category,
          }
        })
      : []

  // --- Elegant Wave Animation (while recording) ---
  const Wave = ({ delay = 0 }: { delay?: number }) => (
    <motion.span
      initial={{ scaleY: 0.4, opacity: 0.9 }}
      animate={{ scaleY: [0.4, 1, 0.4] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
      className="inline-block w-1.5 mx-1 rounded-full bg-gradient-to-b from-primary/70 via-secondary/70 to-accent/70 origin-bottom"
      style={{ height: "64px" }}
    />
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20">
        <Canvas camera={{ position: [0, 3, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <pointLight position={[-5, 3, 0]} intensity={0.5} color="#ec4899" />
          <pointLight position={[5, 3, 0]} intensity={0.5} color="#06b6d4" />
          <MapTerrain />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />
        </Canvas>
      </div>

      {/* Floating orbs for ambiance */}
      <motion.div
        animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
        transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -80, 0], y: [0, 80, 0] }}
        transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 5 }}
        className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 blur-3xl"
      />

      <div className="container mx-auto px-4 py-12 relative z-10 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Check in with Yourself
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Share how you feel right now — ANA will sense which inner characters are most present.
          </p>
        </motion.div>

        {/* Input Mode Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12"
        >
          {inputModes.map((mode, index) => {
            const Icon = mode.icon
            const isSelected = selectedMode === mode.id
            return (
              <motion.button
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode.id)
                  // reset when switching modes
                  setIsRecording(false)
                  if (mediaRecorderRef.current?.state === "recording") {
                    mediaRecorderRef.current.stop()
                  }
                  resetResults()

                  // for video mode, boot up camera preview
                  if (mode.id === "video") {
                    startVideoPreview()
                  }
                }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
                className={`relative p-8 rounded-3xl border-2 transition-all duration-300 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                    : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <div
                  className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{mode.title}</h3>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
                {isSelected && (
                  <motion.div
                    layoutId="selected-indicator"
                    className="absolute inset-0 rounded-3xl border-2 border-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>
            )
          })}
        </motion.div>

        {/* Input Area */}
        <AnimatePresence mode="wait">
          {selectedMode && (
            <motion.div
              key={selectedMode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="mb-12"
            >
              <div className="bg-card rounded-3xl p-8 border border-border shadow-lg">
                {selectedMode === "text" && (
                  <div>
                    <Textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type what's on your mind…"
                      className="min-h-[200px] border-2 focus:border-primary rounded-2xl resize-none"
                      style={{ fontSize: "19px", lineHeight: "1.6" }}
                    />
                    {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                  </div>
                )}

                {selectedMode === "voice" && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <motion.button
                      onClick={toggleRecording}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={isAnalyzing}
                      className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isRecording
                          ? "bg-gradient-to-br from-pink-500/90 to-rose-500/90 shadow-lg shadow-rose-500/30"
                          : "bg-gradient-to-br from-primary to-secondary hover:shadow-lg hover:shadow-primary/30"
                      }`}
                    >
                      <Mic className="w-12 h-12 text-white" />
                      {isRecording && (
                        <motion.div
                          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.35, 0.5] }}
                          transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                          className="absolute inset-0 rounded-full bg-white/10"
                        />
                      )}
                    </motion.button>

                    {/* Elegant wave animation */}
                    <AnimatePresence>
                      {isRecording && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="mt-8 w-full max-w-lg flex items-end justify-center"
                        >
                          <div className="px-6 py-5 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 w-full flex items-center justify-center">
                            <div className="flex items-end justify-center">
                              {/* sequence of gentle waves */}
                              <Wave delay={0} />
                              <Wave delay={0.12} />
                              <Wave delay={0.24} />
                              <Wave delay={0.36} />
                              <Wave delay={0.48} />
                              <Wave delay={0.6} />
                              <Wave delay={0.72} />
                              <Wave delay={0.84} />
                              <Wave delay={0.96} />
                              <Wave delay={1.08} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="mt-6 text-muted-foreground">
                      {isRecording ? "Listening… click to stop" : "Click the mic to start recording"}
                    </p>

                    {transcript && (
                      <div className="mt-6 w-full max-w-2xl">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Transcript</div>
                        <div className="p-4 rounded-xl border border-border bg-card/60 text-sm leading-relaxed">
                          {transcript}
                        </div>
                      </div>
                    )}

                    {!supportsWebm && (
                      <p className="mt-4 text-xs text-amber-600">
                        Your browser may not support <code>audio/webm</code>. Recording will still try to proceed.
                      </p>
                    )}

                    {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}
                  </div>
                )}

                {selectedMode === "video" && (
                  <div className="flex flex-col items-center justify-center py-6 gap-4">
                    {/* Video Preview Box */}
                    <div className="w-full max-w-md aspect-video bg-muted rounded-2xl flex items-center justify-center border-2 border-dashed border-border overflow-hidden">
                      <video
                        ref={videoPreviewRef}
                        className="w-full h-full object-cover"
                        playsInline
                        autoPlay
                        muted
                        controls={!!recordedUrl}
                      />
                    </div>

                    {/* Buttons under the preview */}
                    {!isVideoReady && !hasRecordedClip && !isVideoRecording && (
                      <Button onClick={startVideoPreview} className="px-6 py-5 rounded-full">
                        Enable Camera
                      </Button>
                    )}

                    {isVideoReady && !isVideoRecording && (
                      <Button
                        onClick={async () => {
                          await startVideoRecording()
                          setIsVideoRecording(true)
                        }}
                        className="px-6 py-5 rounded-full bg-gradient-to-r from-primary to-secondary text-white"
                      >
                        Start Talking
                      </Button>
                    )}

                    {isVideoRecording && (
                      <Button
                        onClick={async () => {
                          await stopVideoRecording()
                          setIsVideoRecording(false)
                        }}
                        variant="destructive"
                        className="px-6 py-5 rounded-full"
                      >
                        Stop Recording
                      </Button>
                    )}

                    {hasRecordedClip && !isVideoRecording && (
                      <div className="flex items-center gap-3">
                        <Button onClick={retryVideo} variant="secondary" className="gap-2">
                          <RotateCcw className="w-4 h-4" />
                          Retry
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Preview above, then click “Analyze My Feelings”
                        </span>
                      </div>
                    )}

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                  </div>
                )}



                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 flex justify-center"
                >
                  <Button
                    onClick={handleAnalyze}
                    disabled={
                      isAnalyzing ||
                      (selectedMode === "text" && !textInput.trim()) ||
                      (selectedMode === "voice" && isRecording) ||
                      (selectedMode === "video" && isVideoRecording)
                    }
                    size="lg"
                    className="bg-gradient-to-r from-primary via-secondary to-accent text-white px-12 py-6 text-lg rounded-full hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
                  >
                    {isAnalyzing ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                      >
                        <Sparkles className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      "Analyze My Feelings"
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Display */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Your Inner Voices Today
              </h2>

              {(selectedMode === "voice" || selectedMode === "video") && transcript && (
                <p className="text-center text-sm text-muted-foreground mb-6">
                  Based on what you said: <span className="italic">“{transcript}”</span>
                </p>
              )}

              {/* Vision summary when video mode */}
              {selectedMode === "video" && visionSummary && (
                <div className="max-w-3xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-card/60">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Dominant Emotion</div>
                    <div className="text-lg font-semibold">{visionSummary.dominant_emotion || "Neutral"}</div>
                    {visionSummary.emotions && Object.keys(visionSummary.emotions).length > 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {Object.entries(visionSummary.emotions)
                          .sort((a, b) => (b[1] as number) - (a[1] as number))
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span>{k}</span>
                              <span>{String(v)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-card/60">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Dominant Gesture</div>
                    <div className="text-lg font-semibold">{visionSummary.dominant_gesture || "—"}</div>
                    {visionSummary.gestures && Object.keys(visionSummary.gestures).length > 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {Object.entries(visionSummary.gestures)
                          .sort((a, b) => (b[1] as number) - (a[1] as number))
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span>{k}</span>
                              <span>{String(v)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-6">
                {resultCards.map((character, index) => {
                  const Icon = character.icon
                  return (
                    <motion.div
                      key={`${character.name}-${index}`}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 * index }}
                      className="bg-card rounded-3xl p-6 border border-border shadow-lg hover:shadow-xl transition-shadow duration-300"
                    >
                      <div
                        className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${character.color} flex items-center justify-center`}
                      >
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-center mb-2">{character.name}</h3>
                      <div className="flex justify-center mb-3">
                        <CategoryBadge category={character.category as any} />
                      </div>
                      <p className="text-sm text-muted-foreground text-center leading-relaxed">
                        {character.summary}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center"
        >
          <p className="text-muted-foreground mb-6">
            This step helps ANA understand your emotional state before entering your Inner World.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <span>← Back to home</span>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
