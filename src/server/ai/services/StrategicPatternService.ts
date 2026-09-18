import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";

export function planPatternDetection() {
  return planNyxTask({ task: "PATTERN_DETECTION" });
}
