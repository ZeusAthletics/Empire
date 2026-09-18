import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";

export function planSideQuest(risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "SIDE_QUEST_GENERATION", risk });
}

export function planMainQuest() {
  return planNyxTask({ task: "MAIN_QUEST_GENERATION" });
}
