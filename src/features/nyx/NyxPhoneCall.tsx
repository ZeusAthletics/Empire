"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Volume2 } from "lucide-react";
import { playPhoneBase64Mp3, stopPhoneAudio } from "@/features/nyx/phoneAudio";
import { playRandomWelcome, startListeningCue, startListeningCueLoop } from "@/features/nyx/phoneSounds";
import { startEnergyVad, type VadController } from "@/features/nyx/phoneVad";

type CallPhase = "dialing" | "ringing" | "connected" | "missed" | "ended";
type TalkMode = "idle" | "user_speaking" | "processing" | "nyx_speaking";

type Caption = { role: "me" | "nyx"; text: string };

function playRingBurst(ctx: AudioContext, when: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, when);
  osc.frequency.setValueAtTime(480, when + 0.2);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.08, when + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.85);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.9);
}

async function playRings(times = 3): Promise<void> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const start = ctx.currentTime + 0.05;
  for (let i = 0; i < times; i += 1) {
    playRingBurst(ctx, start + i * 1.6);
  }
  await new Promise((resolve) => window.setTimeout(resolve, times * 1600 + 200));
  await ctx.close().catch(() => undefined);
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NyxPhoneCall({
  intimateActive,
  onClose,
  toast,
}: {
  intimateActive: boolean;
  onClose: () => void;
  toast: (message: string) => void;
}) {
  const [phase, setPhase] = useState<CallPhase>("dialing");
  const [talkMode, setTalkMode] = useState<TalkMode>("idle");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [statusLine, setStatusLine] = useState("bellen…");
  const [elapsed, setElapsed] = useState(0);

  const callIdRef = useRef<string | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const closedRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const talkModeRef = useRef<TalkMode>("idle");
  const phaseRef = useRef<CallPhase>("dialing");
  const vadRef = useRef<VadController | null>(null);
  const listenLoopStopRef = useRef<(() => void) | null>(null);
  const submittingRef = useRef(false);

  function setMode(next: TalkMode) {
    talkModeRef.current = next;
    setTalkMode(next);
  }

  function setCallPhase(next: CallPhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  useEffect(() => {
    void startCall();
    return () => {
      closedRef.current = true;
      teardownLiveMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "connected") return;
    connectedAtRef.current = Date.now();
    const tick = window.setInterval(() => {
      const start = connectedAtRef.current;
      if (!start) return;
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [phase]);

  function stopListeningLoop() {
    listenLoopStopRef.current?.();
    listenLoopStopRef.current = null;
    stopPhoneAudio();
  }

  function startListeningLoop() {
    stopListeningLoop();
    listenLoopStopRef.current = startListeningCueLoop(4800);
  }

  function teardownLiveMic() {
    stopListeningLoop();
    vadRef.current?.stop();
    vadRef.current = null;
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
  }

  async function startLiveConversation() {
    if (closedRef.current || phaseRef.current !== "connected") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (closedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaRef.current = stream;
      setMode("idle");
      setStatusLine("nyx luistert…");
      startListeningLoop();

      vadRef.current = startEnergyVad({
        stream,
        // Stay armed while idle or mid-utterance so silence can end the turn.
        isArmed: () =>
          phaseRef.current === "connected" &&
          (talkModeRef.current === "idle" || talkModeRef.current === "user_speaking") &&
          !submittingRef.current &&
          !closedRef.current,
        onSpeechStart: () => {
          if (closedRef.current || talkModeRef.current !== "idle") return;
          beginUtteranceCapture();
        },
        onSpeechEnd: () => {
          if (closedRef.current || talkModeRef.current !== "user_speaking") return;
          void finishUtteranceCapture();
        },
      });
    } catch {
      toast("Microfoon niet beschikbaar — telefoon werkt niet zonder mic.");
      setStatusLine("mic geblokkeerd");
    }
  }

  function beginUtteranceCapture() {
    const stream = mediaRef.current;
    if (!stream || recorderRef.current) return;
    stopListeningLoop();
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    try {
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.start(250);
      setMode("user_speaking");
      setStatusLine("jij spreekt…");
    } catch {
      toast("Opname kon niet starten.");
      startListeningLoop();
    }
  }

  async function finishUtteranceCapture() {
    const recorder = recorderRef.current;
    if (!recorder || submittingRef.current) return;
    submittingRef.current = true;
    setMode("processing");
    setStatusLine("nyx luistert…");
    startListeningCue();

    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      try {
        recorder.stop();
      } catch {
        resolve(new Blob([]));
      }
    });
    recorderRef.current = null;

    const callId = callIdRef.current;
    if (!callId || blob.size < 1200) {
      submittingRef.current = false;
      setMode("idle");
      setStatusLine("nyx luistert…");
      startListeningLoop();
      return;
    }

    // One soft cue while waiting — not a loop (loop was drowning / racing Nyx TTS).
    startListeningCue();

    try {
      const body = new FormData();
      body.set("callId", callId);
      body.set("audio", blob, "turn.webm");
      const response = await fetch("/api/nyx/phone/turn", { method: "POST", body });
      const data = (await response.json()) as {
        ok: boolean;
        userText?: string;
        nyxText?: string;
        audioBase64?: string;
        error?: string;
        creditEmpty?: boolean;
      };

      if (!response.ok || !data.ok || !data.audioBase64) {
        if (data.creditEmpty) {
          setCallPhase("missed");
          setStatusLine("geen gehoor");
          toast(data.error ?? "Stemtegoed is op.");
          callIdRef.current = null;
          teardownLiveMic();
          return;
        }
        toast(data.error ?? "Beurt mislukt.");
        setMode("idle");
        setStatusLine("nyx luistert…");
        startListeningLoop();
        return;
      }

      stopListeningLoop();
      setCaptions((prev) => [
        ...prev.slice(-4),
        ...(data.userText ? [{ role: "me" as const, text: data.userText }] : []),
        ...(data.nyxText ? [{ role: "nyx" as const, text: data.nyxText }] : []),
      ]);
      setMode("nyx_speaking");
      setStatusLine("nyx spreekt…");
      try {
        await playPhoneBase64Mp3(data.audioBase64);
      } catch {
        toast("Nyx’ stem kon niet afspelen — check geluid / browser-autoplay.");
      }
      if (closedRef.current || phaseRef.current !== "connected") return;
      setMode("idle");
      setStatusLine("nyx luistert…");
      startListeningLoop();
    } catch {
      toast("Verbinding verbroken.");
      setMode("idle");
      setStatusLine("nyx luistert…");
      startListeningLoop();
    } finally {
      submittingRef.current = false;
    }
  }

  async function startCall() {
    setCallPhase("dialing");
    setStatusLine("bellen…");
    try {
      const response = await fetch("/api/nyx/phone/dial", { method: "POST" });
      const data = (await response.json()) as {
        ok: boolean;
        canAnswer?: boolean;
        creditLevel?: string;
        callId?: string | null;
        openerAudioBase64?: string | null;
        openerText?: string | null;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        toast(data.error ?? "Bellen mislukt.");
        setCallPhase("missed");
        setStatusLine("geen verbinding");
        return;
      }

      setCallPhase("ringing");
      setStatusLine("belt…");
      await playRings(data.canAnswer ? 3 : 4);
      if (closedRef.current) return;

      if (!data.canAnswer || !data.callId) {
        setCallPhase("missed");
        setStatusLine("geen gehoor");
        toast(
          data.creditLevel === "empty"
            ? "Nyx neemt niet op — stemtegoed is op of ELEVENLABS_API_KEY ontbreekt op Vercel."
            : "Nyx neemt niet op.",
        );
        return;
      }

      callIdRef.current = data.callId;
      setCallPhase("connected");
      setStatusLine(data.creditLevel === "low" ? "ze moet zo door" : "verbonden");

      setMode("nyx_speaking");
      await playRandomWelcome().catch(() => undefined);
      if (closedRef.current) return;

      if (data.openerText) {
        setCaptions([{ role: "nyx", text: data.openerText }]);
      }
      if (data.openerAudioBase64) {
        await playPhoneBase64Mp3(data.openerAudioBase64).catch(() => undefined);
      }
      if (closedRef.current) return;

      await startLiveConversation();
    } catch {
      if (!closedRef.current) {
        setCallPhase("missed");
        setStatusLine("geen verbinding");
        toast("Bellen mislukt.");
      }
    }
  }

  async function hangup() {
    const callId = callIdRef.current;
    teardownLiveMic();
    setCallPhase("ended");
    setStatusLine("opgehangen");
    if (callId) {
      await fetch("/api/nyx/phone/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      }).catch(() => undefined);
    }
    onClose();
  }

  const headerStatus = phase === "connected" ? formatElapsed(elapsed) : statusLine;
  const lastCaption = captions[captions.length - 1];
  const micLive = phase === "connected" && (talkMode === "idle" || talkMode === "user_speaking");

  return (
    <div className="nyx-ios-call" role="dialog" aria-label="Telefoongesprek met Nyx">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/nyx-phone-bg.jpg" alt="" className="nyx-ios-call-bg" />
      <div className="nyx-ios-call-veil" aria-hidden="true" />

      <div className="nyx-ios-call-top">
        <p className="nyx-ios-call-status">{headerStatus}</p>
        <h2 className="nyx-ios-call-name">
          Nyx
          {intimateActive ? <span aria-label="Spicy mode">🔥</span> : null}
        </h2>
        <p className="nyx-ios-call-sub">{statusLine}</p>
      </div>

      <div className="nyx-ios-call-avatar-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nyx.jpg" alt="Nyx" className="nyx-ios-call-avatar" />
      </div>

      {lastCaption ? (
        <div className={`nyx-ios-call-caption ${lastCaption.role}`}>
          <span>{lastCaption.role === "me" ? "Jij" : "Nyx"}</span>
          <p>{lastCaption.text}</p>
        </div>
      ) : (
        <div className="nyx-ios-call-caption ghost">
          <p>
            {phase === "connected"
              ? "Spreek gewoon — de mic staat aan"
              : phase === "missed"
                ? "Ze neemt nu niet op"
                : "Even geduld…"}
          </p>
        </div>
      )}

      <div className="nyx-ios-call-controls">
        <div className="nyx-ios-call-row">
          <div className="nyx-ios-btn is-static">
            <Volume2 size={22} strokeWidth={2} />
            <span>audio</span>
          </div>
          <div
            className={`nyx-ios-btn is-mic${micLive ? " is-on" : ""}${talkMode === "user_speaking" ? " is-speaking" : ""}`}
            aria-label={
              talkMode === "user_speaking"
                ? "Jij spreekt"
                : talkMode === "processing" || talkMode === "idle"
                  ? "Nyx luistert"
                  : "Mic"
            }
          >
            <Mic size={22} strokeWidth={2} />
            <span>
              {talkMode === "user_speaking"
                ? "jij"
                : talkMode === "nyx_speaking"
                  ? "nyx"
                  : talkMode === "processing"
                    ? "wacht"
                    : phase === "connected"
                      ? "live"
                      : "mic"}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="nyx-ios-hangup"
          onClick={() => void hangup()}
          aria-label={phase === "missed" || phase === "ended" ? "Sluiten" : "Ophangen"}
        >
          <PhoneOff size={28} strokeWidth={2.2} />
        </button>
        <span className="nyx-ios-hangup-label">
          {phase === "missed" || phase === "ended" ? "sluiten" : "ophangen"}
        </span>
      </div>
    </div>
  );
}
