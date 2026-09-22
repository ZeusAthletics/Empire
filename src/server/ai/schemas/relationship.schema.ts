import { randomUUID } from "node:crypto";

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
    progressScenarios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
        },
        required: ["id", "title", "summary"],
      },
    },
  },
  required: [
    "trustScore",
    "warmthScore",
    "tensionScore",
    "headline",
    "analysis",
    "highlights",
    "concerns",
    "progressScenarios",
  ],
} as const;

export type NyxProgressScenario = {
  id: string;
  title: string;
  summary: string;
};

export type NyxRelationshipReview = {
  trustScore: number;
  warmthScore: number;
  tensionScore: number;
  headline: string;
  analysis: string;
  highlights: string[];
  concerns: string[];
  progressScenarios: NyxProgressScenario[];
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

function parseProgressScenarios(value: unknown): NyxProgressScenario[] {
  if (!Array.isArray(value)) return [];
  const out: NyxProgressScenario[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const summary = typeof row.summary === "string" ? row.summary.trim() : "";
    if (!title || !summary) continue;
    const idRaw = typeof row.id === "string" ? row.id.trim() : "";
    out.push({ id: idRaw || randomUUID(), title, summary });
  }
  return out.slice(0, 5);
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
      progressScenarios: parseProgressScenarios(parsed.progressScenarios),
    };
  } catch {
    return null;
  }
}
