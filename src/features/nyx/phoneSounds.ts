import { playPhoneUrl, stopPhoneAudio } from "@/features/nyx/phoneAudio";

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

/** Play listening cues on an interval while Nyx is "on the line" listening. */
export function startListeningCueLoop(everyMs = 5200): () => void {
  let active = true;
  let timer: number | null = null;

  const schedule = () => {
    if (!active) return;
    const jitter = Math.floor(Math.random() * 1400);
    timer = window.setTimeout(() => {
      if (!active) return;
      void playRandomListeningCue().finally(() => {
        schedule();
      });
    }, everyMs + jitter);
  };

  // First cue shortly after arming listen mode.
  timer = window.setTimeout(() => {
    if (!active) return;
    void playRandomListeningCue().finally(() => schedule());
  }, 900);

  return () => {
    active = false;
    if (timer != null) window.clearTimeout(timer);
    timer = null;
    stopPhoneAudio();
  };
}
