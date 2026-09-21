import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";
import type { MediaAsset } from "@/server/domain/media/repository";
import { downloadChatAttachment } from "@/server/domain/nyx/chatAttachmentRepository";

function toDataUrl(bytes: ArrayBuffer, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function roughPdfText(bytes: ArrayBuffer): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const chunks: string[] = [];
  const paren = raw.match(/\(([^()\\]{3,240})\)/g) ?? [];
  for (const part of paren) chunks.push(part.slice(1, -1));
  const streams = raw.match(/stream[\s\S]*?endstream/g) ?? [];
  for (const stream of streams) {
    const cleaned = stream.replace(/[^\x20-\x7E\n\r\t]/g, " ");
    if (cleaned.length > 40) chunks.push(cleaned);
  }
  return chunks.join(" ").replace(/\s{2,}/g, " ").trim().slice(0, 12_000);
}

function isImageType(contentType: string, path: string): boolean {
  if (contentType.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(path);
}

async function analyzeImage(bytes: ArrayBuffer, mime: string, userQuestion: string): Promise<string> {
  if (!openaiConfigured()) return "Afbeelding ontvangen (vision niet beschikbaar — OPENAI_API_KEY ontbreekt).";
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Hardwig stuurde een screenshot of afbeelding in Nyx chat. Vraag/context: ${userQuestion || "(geen extra tekst)"}.
Beschrijf bondig wat relevant is voor feedback (tekst in beeld, UI, document, cijfers, fouten). Nederlands, feitelijk, geen aannames buiten het beeld.`,
          },
          { type: "input_image", image_url: toDataUrl(bytes, mime || "image/jpeg"), detail: "high" },
        ],
      },
    ],
  });
  return (response.output_text ?? "").trim() || "Afbeelding ontvangen; geen beschrijving.";
}

export async function analyzeChatAttachment(input: {
  asset: MediaAsset;
  userQuestion: string;
}): Promise<string> {
  const { bytes, blob } = await downloadChatAttachment(input.asset);
  const path = input.asset.storagePath;
  const contentType = blob.type || "application/octet-stream";

  if (isImageType(contentType, path)) {
    return analyzeImage(bytes, contentType, input.userQuestion);
  }

  if (contentType.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(path)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim().slice(0, 12_000);
    return text ? `Tekstbestand (${path.split("/").pop()}):\n${text}` : "Leeg tekstbestand.";
  }

  if (contentType === "application/pdf" || /\.pdf$/i.test(path)) {
    const extracted = roughPdfText(bytes);
    if (extracted.length > 80) {
      return `PDF — geëxtraheerde tekst (kan onvolledig zijn):\n${extracted}`;
    }
    return "PDF ontvangen; weinig leesbare tekst — stuur desnoods een screenshot van de pagina's.";
  }

  return `Bijlage ontvangen (${contentType || "onbekend type"}, ${Math.round(bytes.byteLength / 1024)} KB). Nyx kan dit type beperkt lezen — gebruik indien mogelijk PDF, tekst of een screenshot.`;
}

export function formatAttachmentBlock(parts: { fileSummary?: string; urlSummary?: string }): string {
  const blocks: string[] = [];
  if (parts.fileSummary?.trim()) {
    blocks.push(`[Hardwig deelde een bestand — inhoud voor Nyx:\n${parts.fileSummary.trim()}]`);
  }
  if (parts.urlSummary?.trim()) {
    blocks.push(`[Hardwig linkte een website — samenvatting voor Nyx:\n${parts.urlSummary.trim()}]`);
  }
  return blocks.join("\n\n");
}
