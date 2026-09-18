import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";

export function planChapter() {
  return planNyxTask({ task: "CHAPTER_PLANNING" });
}

export function planCampaignReplan() {
  return planNyxTask({ task: "CAMPAIGN_REPLAN" });
}
