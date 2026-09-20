export const NYX_OUTREACH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["SILENCE", "TEXT", "PHOTO", "VIDEO"] },
    reason: { type: "string" },
    caption: { type: "string" },
    scene: { type: "string" },
    mediaSource: { type: "string", enum: ["CURATED", "GENERATE"] },
    curatedMediaId: { type: "string" },
  },
  required: ["action", "reason"],
} as const;

export type NyxOutreachDecision = {
  action: "SILENCE" | "TEXT" | "PHOTO" | "VIDEO";
  reason: string;
  caption?: string;
  scene?: string;
  mediaSource?: "CURATED" | "GENERATE";
  curatedMediaId?: string;
};

export function parseOutreachDecision(raw: string | null): NyxOutreachDecision | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as NyxOutreachDecision;
    if (!parsed.action || !parsed.reason) return null;
    if (!["SILENCE", "TEXT", "PHOTO", "VIDEO"].includes(parsed.action)) return null;
    return parsed;
  } catch {
    return null;
  }
}
