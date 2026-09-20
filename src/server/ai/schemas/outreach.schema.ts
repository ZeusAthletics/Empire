/** OpenAI strict JSON schema — all properties required; use null when unused. */
export const NYX_OUTREACH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["SILENCE", "TEXT", "PHOTO", "VIDEO"] },
    reason: { type: "string" },
    caption: { type: ["string", "null"] },
    scene: { type: ["string", "null"] },
    mediaSource: { type: ["string", "null"], enum: ["CURATED", "GENERATE", null] },
    curatedMediaId: { type: ["string", "null"] },
  },
  required: ["action", "reason", "caption", "scene", "mediaSource", "curatedMediaId"],
} as const;

export type NyxOutreachDecision = {
  action: "SILENCE" | "TEXT" | "PHOTO" | "VIDEO";
  reason: string;
  caption?: string | null;
  scene?: string | null;
  mediaSource?: "CURATED" | "GENERATE" | null;
  curatedMediaId?: string | null;
};

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function normalizeOutreachDecision(parsed: NyxOutreachDecision): NyxOutreachDecision {
  return {
    action: parsed.action,
    reason: parsed.reason,
    caption: parsed.caption?.trim() || undefined,
    scene: parsed.scene?.trim() || undefined,
    mediaSource: parsed.mediaSource ?? undefined,
    curatedMediaId: parsed.curatedMediaId?.trim() || undefined,
  };
}

export function parseOutreachDecision(raw: string | null): NyxOutreachDecision | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(extractJsonPayload(raw)) as NyxOutreachDecision;
    if (!parsed.action || !parsed.reason) return null;
    if (!["SILENCE", "TEXT", "PHOTO", "VIDEO"].includes(parsed.action)) return null;
    return normalizeOutreachDecision(parsed);
  } catch {
    return null;
  }
}
