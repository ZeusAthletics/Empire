"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Volume2 } from "lucide-react";
import { playRandomWelcome, startListeningCue } from "@/features/nyx/phoneSounds";

type CallPhase = "dialing" | "ringing" | "connected" | "missed" | "ended";

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

function playBase64Mp3(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Audio afspelen mislukt."));
    void audio.play().catch(reject);
  });
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
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [statusLine, setStatusLine] = useState("bellen…");
  const [elapsed, setElapsed] = useState(0);
  const callIdRef = useRef<string | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const closedRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    void startCall();
    return () => {
      closedRef.current = true;
      stopMic();
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

  function stopMic() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
  }

  async function startCall() {
    setPhase("dialing");
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
        setPhase("missed");
        setStatusLine("geen verbinding");
        return;
      }

      setPhase("ringing");
      setStatusLine("belt…");
      await playRings(data.canAnswer ? 3 : 4);
      if (closedRef.current) return;

      if (!data.canAnswer || !data.callId) {
        setPhase("missed");
        setStatusLine("geen gehoor");
        toast(
          data.creditLevel === "empty"
            ? "Nyx neemt niet op — stemtegoed is op of ELEVENLABS_API_KEY ontbreekt op Vercel."
            : "Nyx neemt niet op.",
        );
        return;
      }

      callIdRef.current = data.callId;
      setPhase("connected");
      setStatusLine(data.creditLevel === "low" ? "ze moet zo door" : "verbonden");

      await playRandomWelcome().catch(() => undefined);
      if (closedRef.current) return;

      if (data.openerText) {
        setCaptions([{ role: "nyx", text: data.openerText }]);
      }
      if (data.openerAudioBase64) {
        await playBase64Mp3(data.openerAudioBase64).catch(() => undefined);
      }
    } catch {
      if (!closedRef.current) {
        setPhase("missed");
        setStatusLine("geen verbinding");
        toast("Bellen mislukt.");
      }
    }
  }

  async function hangup() {
    const callId = callIdRef.current;
    stopMic();
    setPhase("ended");
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

  async function ensureMic(): Promise<MediaStream> {
    if (mediaRef.current) return mediaRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRef.current = stream;
    return stream;
  }

  async function beginHold() {
    if (phase !== "connected" || busy || holding) return;
    try {
      const stream = await ensureMic();
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.start();
      setHolding(true);
      setStatusLine("jij spreekt…");
    } catch {
      toast("Microfoon niet beschikbaar.");
    }
  }

  async function endHold() {
    if (!holding || !recorderRef.current) return;
    const recorder = recorderRef.current;
    setHolding(false);
    setBusy(true);
    setStatusLine("nyx luistert…");

    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.stop();
    });
    recorderRef.current = null;

    const callId = callIdRef.current;
    if (!callId || blob.size < 200) {
      setBusy(false);
      setStatusLine("verbonden");
      return;
    }

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
          setPhase("missed");
          setStatusLine("geen gehoor");
          toast(data.error ?? "Stemtegoed is op.");
          callIdRef.current = null;
          return;
        }
        toast(data.error ?? "Beurt mislukt.");
        setStatusLine("verbonden");
        return;
      }

      setCaptions((prev) => [
        ...prev.slice(-4),
        ...(data.userText ? [{ role: "me" as const, text: data.userText }] : []),
        ...(data.nyxText ? [{ role: "nyx" as const, text: data.nyxText }] : []),
      ]);
      setStatusLine("nyx spreekt…");
      await playBase64Mp3(data.audioBase64).catch(() => undefined);
      setStatusLine("verbonden");
    } catch {
      toast("Verbinding verbroken.");
      setStatusLine("verbonden");
    } finally {
      setBusy(false);
    }
  }

  const headerStatus =
    phase === "connected" ? formatElapsed(elapsed) : statusLine;

  const lastCaption = captions[captions.length - 1];

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
        {phase === "connected" && statusLine !== "verbonden" ? (
          <p className="nyx-ios-call-sub">{statusLine}</p>
        ) : phase !== "connected" ? (
          <p className="nyx-ios-call-sub">{statusLine}</p>
        ) : (
          <p className="nyx-ios-call-sub">Empire</p>
        )}
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
              ? "Houd de microfoon in om te praten"
              : phase === "missed"
                ? "Ze neemt nu niet op"
                : "Even geduld…"}
          </p>
        </div>
      )}

      <div className="nyx-ios-call-controls">
        <div className="nyx-ios-call-row">
          <div className={`nyx-ios-btn is-static${holding ? " is-on" : ""}`}>
            <Volume2 size={22} strokeWidth={2} />
            <span>audio</span>
          </div>
          {phase === "connected" ? (
            <button
              type="button"
              className={`nyx-ios-btn is-mic${holding ? " is-on" : ""}`}
              disabled={busy}
              aria-label={holding ? "Laat los om te versturen" : "Houd in om te praten"}
              onPointerDown={(event) => {
                event.preventDefault();
                void beginHold();
              }}
              onPointerUp={() => void endHold()}
              onPointerLeave={() => {
                if (holding) void endHold();
              }}
              onPointerCancel={() => {
                if (holding) void endHold();
              }}
            >
              <Mic size={22} strokeWidth={2} />
              <span>{holding ? "loslaten" : busy ? "wacht…" : "spreken"}</span>
            </button>
          ) : (
            <div className="nyx-ios-btn is-static">
              <Mic size={22} strokeWidth={2} />
              <span>spreken</span>
            </div>
          )}
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
