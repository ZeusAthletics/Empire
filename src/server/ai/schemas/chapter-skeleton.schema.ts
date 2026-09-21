import type { StatKey } from "@/server/domain/player/types";

export const CHAPTER_SKELETON_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subtitle: { type: ["string", "null"] },
    strategicPurpose: { type: "string" },
    startConditions: { type: "array", items: { type: "string" } },
    desiredState: { type: "array", items: { type: "string" } },
    dependencies: { type: "array", items: { type: "string" } },
    relatedStats: { type: "array", items: { type: "string" } },
    strategicRisks: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    economicFrom: { type: "number" },
    economicTo: { type: "number" },
    exitCriteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          kind: { type: "string", enum: ["STAT", "EMPIRE_VALUE", "MISSION_COUNT", "MANUAL"] },
          statKey: { type: ["string", "null"] },
          comparator: { type: ["string", "null"] },
          targetValue: { type: ["number", "null"] },
        },
        required: ["label", "kind", "statKey", "comparator", "targetValue"],
      },
    },
    rationale: { type: "string" },
    confidence: { type: "number" },
  },
  required: [
    "subtitle",
    "strategicPurpose",
    "startConditions",
    "desiredState",
    "dependencies",
    "relatedStats",
    "strategicRisks",
    "assumptions",
    "economicFrom",
    "economicTo",
    "exitCriteria",
    "rationale",
    "confidence",
  ],
} as const;

export type ExitComparator = "GTE" | "LTE" | "EQ";

export type ExitCriterionDraft = {
  label: string;
  kind: "STAT" | "EMPIRE_VALUE" | "MISSION_COUNT" | "MANUAL";
  statKey: string | null;
  comparator: ExitComparator | null;
  targetValue: number | null;
};

/** Map model symbols (>=) to Postgres exit_comparator enum (GTE). */
export function normalizeExitComparator(value: string | null | undefined): ExitComparator | null {
  if (value == null || !String(value).trim()) return null;
  const key = String(value).trim().toUpperCase();
  if (key === "GTE" || key === ">=" || key === "GE") return "GTE";
  if (key === "LTE" || key === "<=" || key === "LE") return "LTE";
  if (key === "EQ" || key === "=" || key === "==" || key === "EQUAL") return "EQ";
  return null;
}

function normalizeExitCriterionDraft(raw: ExitCriterionDraft): ExitCriterionDraft {
  const kind = raw.kind;
  const comparator =
    kind === "MANUAL" ? null : normalizeExitComparator(raw.comparator) ?? (kind === "STAT" ? "GTE" : "GTE");
  return {
    ...raw,
    comparator: kind === "MANUAL" ? null : comparator,
    targetValue: raw.targetValue != null ? Number(raw.targetValue) : null,
  };
}

export type ChapterSkeletonPlan = {
  subtitle: string | null;
  strategicPurpose: string;
  startConditions: string[];
  desiredState: string[];
  dependencies: string[];
  relatedStats: string[];
  strategicRisks: string[];
  assumptions: string[];
  economicFrom: number;
  economicTo: number;
  exitCriteria: ExitCriterionDraft[];
  rationale: string;
  confidence: number;
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

export function parseChapterSkeletonPlan(raw: string | null): ChapterSkeletonPlan | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(extractJsonPayload(raw)) as ChapterSkeletonPlan;
    if (!parsed.strategicPurpose || !Array.isArray(parsed.exitCriteria)) return null;
    return {
      ...parsed,
      exitCriteria: parsed.exitCriteria.map((row) => normalizeExitCriterionDraft(row)),
    };
  } catch {
    return null;
  }
}

export function asStatKeys(values: string[]): StatKey[] {
  const allowed = new Set([
    "capital",
    "income",
    "ownership",
    "network",
    "authority",
    "strategy",
    "execution",
    "optionality",
  ]);
  return values.filter((v): v is StatKey => allowed.has(v));
}
