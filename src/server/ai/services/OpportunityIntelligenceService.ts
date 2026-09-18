import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";

export function planOpportunityAnalysis(risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "OPPORTUNITY_ANALYSIS", risk });
}

export function planOpportunityPrefilter() {
  return planNyxTask({ task: "OPPORTUNITY_PREFILTER" });
}
