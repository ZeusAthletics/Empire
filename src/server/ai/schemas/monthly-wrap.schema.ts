/** OpenAI strict JSON for monthly wrap narrative (metrics computed server-side). */
export const MONTHLY_WRAP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    biggestWin: { type: "string" },
    biggestMistake: { type: "string" },
    bestRelationship: { type: "string" },
    keyDecision: { type: "string" },
    bestMission: { type: "string" },
    timeSink: { type: "string" },
    whatChanged: { type: "string" },
    nyx: { type: "string" },
  },
  required: [
    "biggestWin",
    "biggestMistake",
    "bestRelationship",
    "keyDecision",
    "bestMission",
    "timeSink",
    "whatChanged",
    "nyx",
  ],
} as const;

export type MonthlyWrapNarrative = {
  biggestWin: string;
  biggestMistake: string;
  bestRelationship: string;
  keyDecision: string;
  bestMission: string;
  timeSink: string;
  whatChanged: string;
  nyx: string;
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

function line(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseMonthlyWrapNarrative(raw: string | null): MonthlyWrapNarrative | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(extractJsonPayload(raw)) as MonthlyWrapNarrative;
    const fields = [
      parsed.biggestWin,
      parsed.biggestMistake,
      parsed.bestRelationship,
      parsed.keyDecision,
      parsed.bestMission,
      parsed.timeSink,
      parsed.whatChanged,
      parsed.nyx,
    ];
    if (fields.some((field) => !line(field))) return null;
    return {
      biggestWin: line(parsed.biggestWin),
      biggestMistake: line(parsed.biggestMistake),
      bestRelationship: line(parsed.bestRelationship),
      keyDecision: line(parsed.keyDecision),
      bestMission: line(parsed.bestMission),
      timeSink: line(parsed.timeSink),
      whatChanged: line(parsed.whatChanged),
      nyx: line(parsed.nyx),
    };
  } catch {
    return null;
  }
}
