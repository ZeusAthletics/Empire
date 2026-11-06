import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";

export async function transcribeAudioWithWhisper(input: {
  bytes: Uint8Array;
  filename?: string;
  mimeType?: string;
}): Promise<string> {
  if (!openaiConfigured()) throw new Error("OPENAI_API_KEY ontbreekt voor transcriptie.");

  const filename = input.filename?.trim() || "call.webm";
  const mime = input.mimeType?.trim() || "audio/webm";
  const blob = new Blob([Buffer.from(input.bytes)], { type: mime });
  const file = new File([blob], filename, { type: mime });

  const result = await getOpenAIClient().audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  const text = (result.text ?? "").trim();
  if (!text) throw new Error("Geen spraak herkend.");
  return text;
}
