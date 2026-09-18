import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";

export function planCampaignReview() {
  return planNyxTask({ task: "CAMPAIGN_REVIEW" });
}
