export const MAIN_MISSION_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    missions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          narrativeOrder: { type: "integer" },
          title: { type: "string" },
          why: { type: "string" },
          mainObjective: { type: "string" },
          objectives: { type: "array", items: { type: "string" } },
          strategicReason: { type: "string" },
          successCriteria: { type: "array", items: { type: "string" } },
          expectedStateChanges: { type: "array", items: { type: "string" } },
          unlockConditions: { type: "array", items: { type: "string" } },
          prerequisiteOrder: { type: "integer" },
          difficulty: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "BOSS"] },
          estimateLabel: { type: ["string", "null"] },
          xpReward: { type: "integer" },
          statKey: { type: "string" },
          statAmount: { type: "integer" },
          evidenceRequirement: { type: "string" },
        },
        required: [
          "narrativeOrder",
          "title",
          "why",
          "mainObjective",
          "objectives",
          "strategicReason",
          "successCriteria",
          "expectedStateChanges",
          "unlockConditions",
          "prerequisiteOrder",
          "difficulty",
          "estimateLabel",
          "xpReward",
          "statKey",
          "statAmount",
          "evidenceRequirement",
        ],
      },
    },
    rationale: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["missions", "rationale", "confidence"],
} as const;

export type MainMissionPlanItem = {
  narrativeOrder: number;
  title: string;
  why: string;
  mainObjective: string;
  objectives: string[];
  strategicReason: string;
  successCriteria: string[];
  expectedStateChanges: string[];
  unlockConditions: string[];
  prerequisiteOrder: number;
  difficulty: "LOW" | "MEDIUM" | "HIGH" | "BOSS";
  estimateLabel: string | null;
  xpReward: number;
  statKey: string;
  statAmount: number;
  evidenceRequirement: string;
};

export type MainMissionPlan = {
  missions: MainMissionPlanItem[];
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

export function parseMainMissionPlan(raw: string | null): MainMissionPlan | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(extractJsonPayload(raw)) as MainMissionPlan;
    if (!Array.isArray(parsed.missions) || parsed.missions.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
