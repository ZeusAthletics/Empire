/** OpenAI strict JSON — all properties required; use null when unused. */
export const NYX_RELATIONSHIP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    trustScore: { type: "integer" },
    warmthScore: { type: "integer" },
    tensionScore: { type: "integer" },
    headline: { type: "string" },
    analysis: { type: "string" },
    highlights: {
      type: "array",
      items: { type: "string" },
    },
    concerns: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["trustScore", "warmthScore", "tensionScore", "headline", "analysis", "highlights", "concerns"],
} as const;

export type NyxRelationshipReview = {
  trustScore: number;
  warmthScore: number;
  tensionScore: number;
  headline: string;
  analysis: string;
  highlights: string[];
  concerns: string[];
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

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function parseRelationshipReview(raw: string | null): NyxRelationshipReview | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(extractJsonPayload(raw)) as NyxRelationshipReview;
    if (!parsed.headline?.trim() || !parsed.analysis?.trim()) return null;
    return {
      trustScore: clampScore(parsed.trustScore),
      warmthScore: clampScore(parsed.warmthScore),
      tensionScore: clampScore(parsed.tensionScore),
      headline: parsed.headline.trim(),
      analysis: parsed.analysis.trim(),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((item) => typeof item === "string" && item.trim()).map((s) => s.trim())
        : [],
      concerns: Array.isArray(parsed.concerns)
        ? parsed.concerns.filter((item) => typeof item === "string" && item.trim()).map((s) => s.trim())
        : [],
    };
  } catch {
    return null;
  }
}
