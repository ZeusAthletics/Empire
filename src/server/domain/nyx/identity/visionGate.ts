import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";
import {
  downloadIdentityRefBytes,
  listIdentityRefs,
  type NyxIdentityRef,
} from "@/server/domain/nyx/identity/repository";

function toDataUrl(bytes: ArrayBuffer, mime = "image/jpeg"): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

async function faceRef(): Promise<NyxIdentityRef | null> {
  const refs = await listIdentityRefs();
  return refs.find((ref) => ref.role === "FACE") ?? refs[0] ?? null;
}

export async function passesNyxIdentityGate(candidateBytes: ArrayBuffer): Promise<boolean> {
  if (!openaiConfigured()) return false;
  const ref = await faceRef();
  if (!ref) return false;

  const refBytes = await downloadIdentityRefBytes(ref);
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Compare the candidate image to the reference face photo. Is the candidate the SAME woman (Nyx): same face structure, hair, necklace, black-gold aesthetic? Answer only JSON: {"samePerson":true|false,"confidence":0-1}. Reject if different person or face drift.`,
          },
          { type: "input_image", image_url: toDataUrl(refBytes), detail: "low" },
          { type: "input_image", image_url: toDataUrl(candidateBytes), detail: "low" },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "identity_check",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            samePerson: { type: "boolean" },
            confidence: { type: "number" },
          },
          required: ["samePerson", "confidence"],
        },
      },
    },
  });

  const raw = response.output_text ?? "";
  try {
    const parsed = JSON.parse(raw) as { samePerson?: boolean; confidence?: number };
    return Boolean(parsed.samePerson) && (parsed.confidence ?? 0) >= 0.65;
  } catch {
    return false;
  }
}
