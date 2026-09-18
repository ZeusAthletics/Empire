import {
  escalateFromRisk,
  maxTier,
  scoreRisk,
  TASK_DEFAULT_TIER,
  TASK_MINIMUM_TIER,
  tierFromScore,
} from "@/server/ai/routing/escalation";
import type { IntelligenceTask } from "@/server/ai/routing/IntelligenceTask";
import {
  normalizeRiskProfile,
  type IntelligenceRiskProfile,
} from "@/server/ai/routing/IntelligenceRiskProfile";
import { getModelForTier, type ModelTier } from "@/server/ai/routing/modelConfig";

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export type ModelRoutingDecision = {
  task: IntelligenceTask;
  modelTier: ModelTier;
  model: string;
  reasoningEffort: ReasoningEffort;
  reason: string;
  score: number;
  risk: IntelligenceRiskProfile;
};

function effortFor(tier: ModelTier): ReasoningEffort {
  if (tier === "ECONOMY") return "none";
  if (tier === "BALANCED") return "low";
  return "high";
}

export function routeIntelligenceTask(
  task: IntelligenceTask,
  risk?: Partial<IntelligenceRiskProfile>,
): ModelRoutingDecision {
  const profile = normalizeRiskProfile(risk);
  const score = scoreRisk(profile);
  const defaultTier = TASK_DEFAULT_TIER[task];
  const formulaTier = tierFromScore(score);
  const minimumTier = TASK_MINIMUM_TIER[task];
  const extraTier = escalateFromRisk(task, profile);
  const modelTier = maxTier(defaultTier, formulaTier, ...(minimumTier ? [minimumTier] : []), ...(extraTier ? [extraTier] : []));

  const parts = [`default ${defaultTier}`, `score ${score.toFixed(2)}→${formulaTier}`];
  if (minimumTier) parts.push(`min ${minimumTier}`);
  if (extraTier) parts.push(`risk escalate ${extraTier}`);

  return {
    task,
    modelTier,
    model: getModelForTier(modelTier),
    reasoningEffort: effortFor(modelTier),
    reason: parts.join("; "),
    score,
    risk: profile,
  };
}

export class AIModelRouter {
  route(task: IntelligenceTask, risk?: Partial<IntelligenceRiskProfile>) {
    return routeIntelligenceTask(task, risk);
  }
}
