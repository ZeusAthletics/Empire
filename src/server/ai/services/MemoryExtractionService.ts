import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";

export function planMemoryExtraction() {
  return planNyxTask({ task: "MEMORY_EXTRACTION" });
}
