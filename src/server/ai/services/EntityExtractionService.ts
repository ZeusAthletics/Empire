import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";

export function planEntityExtraction() {
  return planNyxTask({ task: "ENTITY_EXTRACTION" });
}
