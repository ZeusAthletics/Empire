"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";
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
  const [statusLine, setStatusLine] = useState("Verbinden…");
  const callIdRef = useRef<string | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const closedRef = useRef(false);

  useEffect(() => {
    void startCall();
    return () => {
      closedRef.current = true;
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopMic() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
  }

  async function startCall() {
    setPhase("dialing");
    setStatusLine("Bellen…");
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
        setStatusLine("Geen verbinding");
        return;
      }

      setPhase("ringing");
      setStatusLine("Belt…");
      await playRings(data.canAnswer ? 3 : 4);
      if (closedRef.current) return;

      if (!data.canAnswer || !data.callId) {
        setPhase("missed");
        setStatusLine("Geen gehoor");
        toast(
          data.creditLevel === "empty"
            ? "Nyx neemt niet op — stemtegoed is op of ELEVENLABS_API_KEY ontbreekt op Vercel."
            : "Nyx neemt niet op.",
        );
        return;
      }

      callIdRef.current = data.callId;
      setPhase("connected");
      setStatusLine(data.creditLevel === "low" ? "In gesprek · ze moet zo door" : "In gesprek");

      // Always start with a local welcomeN.mp3, then optional low-credit TTS wrap-up.
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
        setStatusLine("Geen verbinding");
        toast("Bellen mislukt.");
      }
    }
  }

  async function hangup() {
    const callId = callIdRef.current;
    stopMic();
    setPhase("ended");
    setStatusLine("Opgehangen");
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
      setStatusLine("Luisteren…");
    } catch {
      toast("Microfoon niet beschikbaar.");
    }
  }

  async function endHold() {
    if (!holding || !recorderRef.current) return;
    const recorder = recorderRef.current;
    setHolding(false);
    setBusy(true);
    setStatusLine("Nyx denkt na…");

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
      setStatusLine("In gesprek");
      return;
    }

    // Local listeningN.mp3 while STT + reply + TTS run.
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
          setStatusLine("Geen gehoor");
          toast(data.error ?? "Stemtegoed is op.");
          callIdRef.current = null;
          return;
        }
        toast(data.error ?? "Beurt mislukt.");
        setStatusLine("In gesprek");
        return;
      }

      setCaptions((prev) => [
        ...prev.slice(-6),
        ...(data.userText ? [{ role: "me" as const, text: data.userText }] : []),
        ...(data.nyxText ? [{ role: "nyx" as const, text: data.nyxText }] : []),
      ]);
      setStatusLine("Nyx spreekt…");
      await playBase64Mp3(data.audioBase64).catch(() => undefined);
      setStatusLine("In gesprek");
    } catch {
      toast("Verbinding verbroken.");
      setStatusLine("In gesprek");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nyx-phone-overlay" role="dialog" aria-label="Telefoongesprek met Nyx">
      <div className="nyx-phone-card">
        <img src="/nyx.jpg" alt="" className="nyx-phone-avatar" />
        <h3 className="display d-md" style={{ margin: "10px 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          Nyx
          {intimateActive ? (
            <span aria-label="Spicy mode" title="Spicy mode">
              🔥
            </span>
          ) : null}
        </h3>
        <p className="eyebrow muted" style={{ margin: 0 }}>
          {statusLine}
        </p>

        {captions.length ? (
          <div className="nyx-phone-captions">
            {captions.slice(-4).map((line, index) => (
              <p key={`${line.role}-${index}`} className={line.role === "me" ? "me" : "nyx"}>
                <span className="eyebrow">{line.role === "me" ? "U" : "Nyx"}</span>
                {line.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="body muted" style={{ marginTop: 16, textAlign: "center" }}>
            {phase === "ringing" || phase === "dialing"
              ? "Even geduld…"
              : phase === "missed"
                ? "Ze neemt nu niet op."
                : "Houd de microfoon in om te praten."}
          </p>
        )}

        <div className="nyx-phone-actions">
          {phase === "connected" ? (
            <button
              type="button"
              className={`nyx-phone-ptt${holding ? " is-hold" : ""}`}
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
              <Mic size={22} strokeWidth={2.2} />
              {holding ? "Loslaten" : busy ? "Wachten…" : "Inhouden"}
            </button>
          ) : null}
          <button type="button" className="nyx-phone-hangup" onClick={() => void hangup()} aria-label="Ophangen">
            <PhoneOff size={18} strokeWidth={2.2} />
            {phase === "missed" || phase === "ended" ? "Sluiten" : "Ophangen"}
          </button>
        </div>
      </div>
    </div>
  );
}
