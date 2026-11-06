/** Shared phone-call audio playback — stops cues before Nyx speaks, uses Blob URLs (more reliable than huge data: URIs). */

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

export function stopPhoneAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.removeAttribute("src");
      currentAudio.load();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function playElement(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
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
    audio.volume = 1;
    void audio.play().then(undefined, (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Audio play geblokkeerd."));
    });
  });
}

export async function playPhoneUrl(url: string): Promise<void> {
  stopPhoneAudio();
  const audio = new Audio(url);
  currentAudio = audio;
  await playElement(audio);
}

export async function playPhoneBase64Mp3(base64: string): Promise<void> {
  const clean = base64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, "").trim();
  if (!clean) throw new Error("Lege audio-response.");

  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);

  stopPhoneAudio();
  currentObjectUrl = objectUrl;
  const audio = new Audio(objectUrl);
  currentAudio = audio;
  try {
    await playElement(audio);
  } finally {
    // Keep object URL until next play/stop so mid-play revoke doesn't cut audio.
  }
}
