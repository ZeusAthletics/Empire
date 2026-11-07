/** Simple energy-based VAD for phone mode (no extra deps). */

export type VadSpeechState = "silence" | "speech";

export type VadController = {
  stop: () => void;
};

const SPEECH_THRESHOLD = 0.025;
const SILENCE_THRESHOLD = 0.014;
const SPEECH_START_MS = 140;
const SILENCE_END_MS = 700;
const MIN_SPEECH_MS = 380;
const MAX_SPEECH_MS = 22_000;
const POLL_MS = 50;

export function startEnergyVad(input: {
  stream: MediaStream;
  /** When false, ignore mic energy (Nyx speaking / turn in flight). */
  isArmed: () => boolean;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
}): VadController {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(input.stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.5;
  source.connect(analyser);

  const data = new Float32Array(analyser.fftSize);
  let speech = false;
  let speechMs = 0;
  let silenceMs = 0;
  let utteranceMs = 0;
  let timer: number | null = null;
  let stopped = false;

  function rms() {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const sample = data[i] ?? 0;
      sum += sample * sample;
    }
    return Math.sqrt(sum / data.length);
  }

  function tick() {
    if (stopped) return;
    if (!input.isArmed()) {
      // Disarmed during Nyx speech / processing — drop partial capture quietly.
      speech = false;
      speechMs = 0;
      silenceMs = 0;
      utteranceMs = 0;
      return;
    }

    const level = rms();
    if (!speech) {
      if (level >= SPEECH_THRESHOLD) {
        speechMs += POLL_MS;
        if (speechMs >= SPEECH_START_MS) {
          speech = true;
          silenceMs = 0;
          utteranceMs = 0;
          input.onSpeechStart();
        }
      } else {
        speechMs = 0;
      }
      return;
    }

    utteranceMs += POLL_MS;
    if (level <= SILENCE_THRESHOLD) {
      silenceMs += POLL_MS;
      if (silenceMs >= SILENCE_END_MS && utteranceMs >= MIN_SPEECH_MS) {
        speech = false;
        speechMs = 0;
        silenceMs = 0;
        utteranceMs = 0;
        input.onSpeechEnd();
      }
    } else {
      silenceMs = 0;
      if (utteranceMs >= MAX_SPEECH_MS) {
        speech = false;
        speechMs = 0;
        silenceMs = 0;
        utteranceMs = 0;
        input.onSpeechEnd();
      }
    }
  }

  void ctx.resume().catch(() => undefined);
  timer = window.setInterval(tick, POLL_MS);

  return {
    stop() {
      stopped = true;
      if (timer != null) window.clearInterval(timer);
      timer = null;
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => undefined);
    },
  };
}
