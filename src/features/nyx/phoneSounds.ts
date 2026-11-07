import { playPhoneUrl } from "@/features/nyx/phoneAudio";

type PhoneSoundCatalog = {
  welcome: string[];
  listening: string[];
};

let catalogPromise: Promise<PhoneSoundCatalog> | null = null;

async function loadCatalog(): Promise<PhoneSoundCatalog> {
  try {
    const response = await fetch("/api/nyx/phone/sounds", { cache: "no-store" });
    const data = (await response.json()) as { ok?: boolean; welcome?: string[]; listening?: string[] };
    return {
      welcome: data.welcome?.length ? data.welcome : ["/sounds/welcome1.mp3"],
      listening: data.listening?.length ? data.listening : ["/sounds/listening1.mp3"],
    };
  } catch {
    return {
      welcome: ["/sounds/welcome1.mp3"],
      listening: ["/sounds/listening1.mp3"],
    };
  }
}

function getCatalog() {
  if (!catalogPromise) catalogPromise = loadCatalog();
  return catalogPromise;
}

function pickRandom(urls: string[]): string | null {
  if (!urls.length) return null;
  return urls[Math.floor(Math.random() * urls.length)] ?? null;
}

/** Random welcomeN.mp3 after pickup. */
export async function playRandomWelcome(): Promise<void> {
  const catalog = await getCatalog();
  const url = pickRandom(catalog.welcome);
  if (!url) return;
  await playPhoneUrl(url);
}

/** Random listeningN.mp3 while the turn is processing. */
export async function playRandomListeningCue(): Promise<void> {
  const catalog = await getCatalog();
  const url = pickRandom(catalog.listening);
  if (!url) return;
  await playPhoneUrl(url).catch(() => undefined);
}

/** Fire-and-forget listening cue (does not block the API turn). */
export function startListeningCue(): void {
  void playRandomListeningCue();
}

/**
 * One soft "mm" after Hardwig has been talking for a bit — not on short lines.
 * Returns a cancel fn (call on speech end / hangup).
 */
export function armLongSpeechListeningCue(afterMs = 3000): () => void {
  let cancelled = false;
  const timer = window.setTimeout(() => {
    if (cancelled) return;
    void playRandomListeningCue();
  }, afterMs);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
