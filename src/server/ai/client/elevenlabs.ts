const ELEVEN_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "KHhGkD3nLOz1oKsM5ijG";
const DEFAULT_MODEL = "eleven_flash_v2_5";

export type ElevenCreditLevel = "ok" | "low" | "empty";

export type ElevenCreditStatus = {
  level: ElevenCreditLevel;
  canSpeak: boolean;
  remaining: number;
  limit: number;
  used: number;
};

type CachedCredits = { at: number; status: ElevenCreditStatus };

let creditCache: CachedCredits | null = null;
const CREDIT_CACHE_MS = 45_000;

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("ELEVENLABS_API_KEY ontbreekt.");
  return key;
}

export function elevenLabsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function getElevenLabsVoiceId() {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
}

export function getElevenLabsModel() {
  return process.env.ELEVENLABS_MODEL?.trim() || DEFAULT_MODEL;
}

function lowThreshold(limit: number) {
  const absolute = Number(process.env.ELEVENLABS_LOW_CREDIT_CHARS ?? "");
  if (Number.isFinite(absolute) && absolute > 0) return absolute;
  return Math.max(500, Math.floor(limit * 0.1));
}

function mapCredits(used: number, limit: number): ElevenCreditStatus {
  const remaining = Math.max(0, limit - used);
  if (remaining <= 0 || limit <= 0) {
    return { level: "empty", canSpeak: false, remaining: 0, limit, used };
  }
  if (remaining <= lowThreshold(limit)) {
    return { level: "low", canSpeak: true, remaining, limit, used };
  }
  return { level: "ok", canSpeak: true, remaining, limit, used };
}

export async function getElevenLabsCreditStatus(force = false): Promise<ElevenCreditStatus> {
  if (!elevenLabsConfigured()) {
    return { level: "empty", canSpeak: false, remaining: 0, limit: 0, used: 0 };
  }
  if (!force && creditCache && Date.now() - creditCache.at < CREDIT_CACHE_MS) {
    return creditCache.status;
  }

  const response = await fetch(`${ELEVEN_BASE}/user/subscription`, {
    headers: { "xi-api-key": apiKey() },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Treat auth/quota failures as empty so we never pretend she can answer.
    if (response.status === 401 || response.status === 402 || response.status === 429) {
      const status = mapCredits(1, 1);
      creditCache = { at: Date.now(), status };
      return status;
    }
    throw new Error(`ElevenLabs subscription check failed (${response.status}): ${body.slice(0, 180)}`);
  }

  const data = (await response.json()) as {
    character_count?: number;
    character_limit?: number;
  };
  const used = Number(data.character_count ?? 0);
  const limit = Number(data.character_limit ?? 0);
  const status = mapCredits(used, limit);
  creditCache = { at: Date.now(), status };
  return status;
}

export function invalidateElevenLabsCreditCache() {
  creditCache = null;
}

export class ElevenLabsQuotaError extends Error {
  constructor(message = "ElevenLabs credits op.") {
    super(message);
    this.name = "ElevenLabsQuotaError";
  }
}

/** Returns mp3 bytes for spoken text. */
export async function synthesizeElevenLabsSpeech(text: string): Promise<Uint8Array> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Geen tekst om uit te spreken.");

  const voiceId = getElevenLabsVoiceId();
  const modelId = getElevenLabsModel();
  const response = await fetch(`${ELEVEN_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: trimmed,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 402 || response.status === 429) {
      invalidateElevenLabsCreditCache();
      throw new ElevenLabsQuotaError(body.slice(0, 180) || "ElevenLabs credits op.");
    }
    throw new Error(`ElevenLabs TTS mislukt (${response.status}): ${body.slice(0, 180)}`);
  }

  invalidateElevenLabsCreditCache();
  const buffer = new Uint8Array(await response.arrayBuffer());
  return buffer;
}

export function audioToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
