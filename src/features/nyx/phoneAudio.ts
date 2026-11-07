/**
 * Phone audio for iOS Safari: unlock Web Audio during the tap that starts the call,
 * then play TTS via decodeAudioData (no HTMLAudioElement.play() after async fetch).
 */

let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentObjectUrl: string | null = null;
let htmlFallback: HTMLAudioElement | null = null;
let unlockAttempted = false;

function AudioCtxClass() {
  return window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
}

export function getPhoneAudioContext(): AudioContext {
  const Ctx = AudioCtxClass();
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function stopCurrentSource() {
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
      currentSource.disconnect();
    } catch {
      /* already stopped */
    }
    currentSource = null;
  }
}

function ensureHtmlFallback() {
  if (htmlFallback) return htmlFallback;
  const audio = new Audio();
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  audio.preload = "auto";
  htmlFallback = audio;
  return audio;
}

/** Resume if iOS suspended the context (mic prompt, lock screen, etc.). */
export async function resumePhoneAudio(): Promise<void> {
  try {
    const ctx = getPhoneAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Call synchronously from the phone-button click (user gesture).
 * Keeps AudioContext "running" so later TTS after fetch still plays on iPhone.
 */
export function unlockPhoneAudio(): void {
  unlockAttempted = true;
  try {
    const ctx = getPhoneAudioContext();
    void ctx.resume().catch(() => undefined);
    // Tiny silent buffer — proves output is allowed under this gesture.
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* ignore */
  }

  try {
    const audio = ensureHtmlFallback();
    // Minimal valid silent WAV (data URI) to unlock HTMLMediaElement policy.
    audio.src =
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    audio.volume = 0.01;
    void audio.play().then(
      () => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
      },
      () => undefined,
    );
  } catch {
    /* ignore */
  }
}

export function stopPhoneAudio() {
  stopCurrentSource();
  if (htmlFallback) {
    try {
      htmlFallback.pause();
      htmlFallback.removeAttribute("src");
      htmlFallback.load();
    } catch {
      /* ignore */
    }
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

async function playViaWebAudio(bytes: Uint8Array): Promise<void> {
  if (!unlockAttempted) unlockPhoneAudio();
  const ctx = getPhoneAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }
  stopCurrentSource();

  // Copy into a real ArrayBuffer — TS rejects ArrayBufferLike / SharedArrayBuffer here.
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const audioBuffer = await ctx.decodeAudioData(copy);

  await new Promise<void>((resolve, reject) => {
    const source = ctx.createBufferSource();
    currentSource = source;
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      if (currentSource === source) currentSource = null;
      resolve();
    };
    try {
      source.start(0);
    } catch (error) {
      currentSource = null;
      reject(error instanceof Error ? error : new Error("Audio start mislukt."));
    }
  });
}

async function playViaHtmlElement(bytes: Uint8Array): Promise<void> {
  const audio = ensureHtmlFallback();
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);
  currentObjectUrl = objectUrl;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
    };
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Audio afspelen mislukt."));
    };
    audio.src = objectUrl;
    audio.volume = 1;
    void audio.play().then(undefined, (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Audio play geblokkeerd."));
    });
  });
}

/** Play raw mp3/wav bytes (preferred path on iPhone). */
export async function playPhoneBytes(bytes: Uint8Array): Promise<void> {
  try {
    await playViaWebAudio(bytes);
  } catch {
    await playViaHtmlElement(bytes);
  }
}

export async function playPhoneUrl(url: string): Promise<void> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error("Geluid kon niet laden.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  await playPhoneBytes(bytes);
}

export async function playPhoneBase64Mp3(base64: string): Promise<void> {
  const clean = base64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, "").trim();
  if (!clean) throw new Error("Lege audio-response.");

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  await playPhoneBytes(bytes);
}

/** Play streamed sentence clips back-to-back. */
export function createPhoneAudioQueue() {
  let chain: Promise<void> = Promise.resolve();
  let stopped = false;

  return {
    enqueue(base64: string) {
      if (stopped) return;
      chain = chain
        .then(async () => {
          if (stopped) return;
          await playPhoneBase64Mp3(base64);
        })
        .catch(() => undefined);
    },
    async drain() {
      await chain;
    },
    stop() {
      stopped = true;
      stopPhoneAudio();
    },
  };
}
