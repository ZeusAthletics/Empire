import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";

export function planCasualChat(text: string, risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "CASUAL_CHAT", text, risk });
}
