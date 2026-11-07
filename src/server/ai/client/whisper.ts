import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";

/** Prefer fast phone STT; override with OPENAI_TRANSCRIBE_MODEL. */
function transcribeModel() {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
}

export async function transcribeAudioWithWhisper(input: {
  bytes: Uint8Array;
  filename?: string;
  mimeType?: string;
}): Promise<string> {
  if (!openaiConfigured()) throw new Error("OPENAI_API_KEY ontbreekt voor transcriptie.");

  const filename = input.filename?.trim() || "call.webm";
  const mime = input.mimeType?.trim() || "audio/webm";
  const primary = transcribeModel();

  function asFile() {
    const blob = new Blob([Buffer.from(input.bytes)], { type: mime });
    return new File([blob], filename, { type: mime });
  }

  try {
    const result = await getOpenAIClient().audio.transcriptions.create({
      file: asFile(),
      model: primary,
    });
    const text = (result.text ?? "").trim();
    if (!text) throw new Error("Geen spraak herkend.");
    return text;
  } catch (error) {
    if (primary === "whisper-1") throw error;
    // Fallback if the fast model is unavailable on this key/account.
    const result = await getOpenAIClient().audio.transcriptions.create({
      file: asFile(),
      model: "whisper-1",
    });
    const text = (result.text ?? "").trim();
    if (!text) throw new Error("Geen spraak herkend.");
    return text;
  }
}
