import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import { getCampaignRecord } from "@/server/domain/campaign/review";
import { createMainQuestProposal } from "@/server/domain/nyx/proposalRepository";
import { proposeMainQuestChange } from "@/server/validation/missionRuleEngine";

export function planSideQuest(risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "SIDE_QUEST_GENERATION", risk });
}

export function planMainQuest() {
  return planNyxTask({ task: "MAIN_QUEST_GENERATION" });
}

export async function runMainQuestPipeline(playerId: string, raw: string) {
  const record = await getCampaignRecord(playerId).catch(() => null);
  const result = proposeMainQuestChange({
    raw,
    lockedByAdmin: Boolean(record?.chapter?.locked_by_admin || record?.campaign.locked_by_admin),
  });
  if (!result.persisted || !result.payload) return result;
  await createMainQuestProposal(playerId, result.payload, result.payload.strategy.strategicReason);
  return result;
}
