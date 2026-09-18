import type { IntelligenceTask } from "@/server/ai/routing/IntelligenceTask";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import type { ModelTier } from "@/server/ai/routing/modelConfig";

/** Tunable in this file only. */
export const ESCALATION = {
  WEIGHTS: {
    complexity: 0.3,
    strategicImpact: 0.35,
    uncertainty: 0.2,
    irreversibility: 0.15,
  },
  ECONOMY_MAX: 0.3,
  BALANCED_MAX: 0.65,
  SIDE_QUEST_SOL_IMPACT: 0.85,
  CAMPAIGN_CHANGING_IMPACT: 0.8,
  CAMPAIGN_CHANGING_IRREVERSIBILITY: 0.8,
} as const;

const TIER_RANK: Record<ModelTier, number> = {
  ECONOMY: 0,
  BALANCED: 1,
  STRATEGIC: 2,
};

const TIER_BY_RANK: ModelTier[] = ["ECONOMY", "BALANCED", "STRATEGIC"];

export const TASK_DEFAULT_TIER: Record<IntelligenceTask, ModelTier> = {
  MEMORY_EXTRACTION: "ECONOMY",
  ENTITY_EXTRACTION: "ECONOMY",
  JOURNAL_CLASSIFICATION: "ECONOMY",
  CONTENT_FORMATTING: "ECONOMY",
  OPPORTUNITY_PREFILTER: "ECONOMY",
  CASUAL_CHAT: "BALANCED",
  PERSONAL_REFLECTION: "BALANCED",
  OPPORTUNITY_ANALYSIS: "BALANCED",
  OPPORTUNITY_RANKING: "BALANCED",
  SIDE_QUEST_GENERATION: "BALANCED",
  NYX_EXPLANATION: "BALANCED",
  MISSION_COPY_GENERATION: "BALANCED",
  MONTHLY_WRAP_ANALYSIS: "BALANCED",
  PATTERN_DETECTION: "BALANCED",
  HIGH_IMPACT_SIDE_QUEST: "STRATEGIC",
  MAIN_QUEST_GENERATION: "STRATEGIC",
  CHAPTER_PLANNING: "STRATEGIC",
  TARGET_STATE_ANALYSIS: "STRATEGIC",
  CAMPAIGN_REVIEW: "STRATEGIC",
  CAMPAIGN_REPLAN: "STRATEGIC",
  STRATEGIC_DECISION: "STRATEGIC",
};

export const TASK_MINIMUM_TIER: Partial<Record<IntelligenceTask, ModelTier>> = {
  CASUAL_CHAT: "BALANCED",
  PERSONAL_REFLECTION: "BALANCED",
  SIDE_QUEST_GENERATION: "BALANCED",
  HIGH_IMPACT_SIDE_QUEST: "STRATEGIC",
  MAIN_QUEST_GENERATION: "STRATEGIC",
  CHAPTER_PLANNING: "STRATEGIC",
  TARGET_STATE_ANALYSIS: "STRATEGIC",
  CAMPAIGN_REPLAN: "STRATEGIC",
  STRATEGIC_DECISION: "STRATEGIC",
};

export function maxTier(...tiers: ModelTier[]): ModelTier {
  return TIER_BY_RANK[Math.max(...tiers.map((tier) => TIER_RANK[tier]))] ?? "ECONOMY";
}

export function scoreRisk(profile: IntelligenceRiskProfile): number {
  const { WEIGHTS } = ESCALATION;
  return (
    profile.complexity * WEIGHTS.complexity +
    profile.strategicImpact * WEIGHTS.strategicImpact +
    profile.uncertainty * WEIGHTS.uncertainty +
    profile.irreversibility * WEIGHTS.irreversibility
  );
}

export function tierFromScore(score: number): ModelTier {
  if (score <= ESCALATION.ECONOMY_MAX) return "ECONOMY";
  if (score <= ESCALATION.BALANCED_MAX) return "BALANCED";
  return "STRATEGIC";
}

export function escalateFromRisk(task: IntelligenceTask, profile: IntelligenceRiskProfile): ModelTier | null {
  if (task === "SIDE_QUEST_GENERATION" && profile.strategicImpact >= ESCALATION.SIDE_QUEST_SOL_IMPACT) {
    return "STRATEGIC";
  }
  if (profile.campaignChanging) return "STRATEGIC";
  if (
    profile.strategicImpact >= ESCALATION.CAMPAIGN_CHANGING_IMPACT &&
    profile.irreversibility >= ESCALATION.CAMPAIGN_CHANGING_IRREVERSIBILITY
  ) {
    return "STRATEGIC";
  }
  return null;
}
