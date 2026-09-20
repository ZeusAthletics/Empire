import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";
import {
  downloadIdentityRefBytes,
  getCanonicalFacePrompt,
  listIdentityRefs,
  type NyxIdentityRef,
} from "@/server/domain/nyx/identity/repository";

/** Reject anything that is not essentially the same face as the FACE ref. */
export const IDENTITY_GATE_MIN_CONFIDENCE = 0.88;

function toDataUrl(bytes: ArrayBuffer, mime = "image/jpeg"): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

async function faceRef(): Promise<NyxIdentityRef | null> {
  const refs = await listIdentityRefs();
  return refs.find((ref) => ref.role === "FACE") ?? null;
}

export type IdentityGateResult = {
  pass: boolean;
  samePerson: boolean;
  identicalFace: boolean;
  confidence: number;
  reason: string;
};

export async function checkNyxIdentityGate(candidateBytes: ArrayBuffer): Promise<IdentityGateResult> {
  const fail = (reason: string): IdentityGateResult => ({
    pass: false,
    samePerson: false,
    identicalFace: false,
    confidence: 0,
    reason,
  });

  if (!openaiConfigured()) return fail("OpenAI niet geconfigureerd.");
  const ref = await faceRef();
  if (!ref) return fail("Geen FACE-referentie.");

  const refBytes = await downloadIdentityRefBytes(ref);
  const facePrompt = await getCanonicalFacePrompt();
  const client = getOpenAIClient();

  let response;
  try {
    response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Image 1 is the canonical FACE reference for Nyx. Image 2 is a candidate output.
${
  facePrompt
    ? `\nCanonical face traits (candidate must match these AND image 1):\n${facePrompt}\n`
    : ""
}
Pass ONLY if image 2 shows the EXACT same face as image 1 — same person, same facial structure (not a similar model, not a cousin look-alike). Expression, angle, and lighting may differ; identity may not.

Return JSON: identicalFace (true only if face match is exact enough for identity lock), samePerson, confidence 0-1, reason (short).`,
          },
          { type: "input_image", image_url: toDataUrl(refBytes), detail: "high" },
          { type: "input_image", image_url: toDataUrl(candidateBytes), detail: "high" },
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
            identicalFace: { type: "boolean" },
            samePerson: { type: "boolean" },
            confidence: { type: "number" },
            reason: { type: "string" },
          },
          required: ["identicalFace", "samePerson", "confidence", "reason"],
        },
      },
    },
  });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Vision API mislukt.";
    return fail(msg);
  }

  const raw = response.output_text ?? "";
  try {
    const parsed = JSON.parse(raw) as {
      identicalFace?: boolean;
      samePerson?: boolean;
      confidence?: number;
      reason?: string;
    };
    const confidence = parsed.confidence ?? 0;
    const identicalFace = Boolean(parsed.identicalFace);
    const samePerson = Boolean(parsed.samePerson);
    const pass =
      identicalFace &&
      samePerson &&
      confidence >= IDENTITY_GATE_MIN_CONFIDENCE;
    return {
      pass,
      identicalFace,
      samePerson,
      confidence,
      reason: parsed.reason ?? (pass ? "Match." : "Geen exacte face match."),
    };
  } catch {
    return fail("Vision gate antwoord ongeldig.");
  }
}

export async function passesNyxIdentityGate(candidateBytes: ArrayBuffer): Promise<boolean> {
  const result = await checkNyxIdentityGate(candidateBytes);
  return result.pass;
}
