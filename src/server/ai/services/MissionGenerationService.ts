import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { generateMainMissionBatch } from "@/server/ai/services/MainMissionPlanner";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import { getCampaignRecord } from "@/server/domain/campaign/review";
import { insertMainMissionPlan } from "@/server/domain/mission/planRepository";
import { progressCampaign } from "@/server/domain/campaign/director/CampaignDirector";
import { createMainQuestProposal } from "@/server/domain/nyx/proposalRepository";
import { proposeMainQuestChange } from "@/server/validation/missionRuleEngine";

export function planSideQuest(risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "SIDE_QUEST_GENERATION", risk });
}

export function planMainQuest() {
  return planNyxTask({ task: "MAIN_QUEST_GENERATION" });
}

export async function runMainQuestPipeline(playerId: string, raw?: string) {
  const record = await getCampaignRecord(playerId).catch(() => null);
  if (!record?.chapter) {
    return { persisted: false as const, reason: "Geen actief hoofdstuk." };
  }

  if (raw?.trim()) {
    const legacy = proposeMainQuestChange({
      raw,
      lockedByAdmin: Boolean(record.chapter.locked_by_admin || record.campaign.locked_by_admin),
    });
    if (!legacy.persisted || !legacy.payload) return legacy;
    await createMainQuestProposal(playerId, legacy.payload, legacy.payload.strategy.strategicReason);
    return legacy;
  }

  const plan = await generateMainMissionBatch(playerId, record.chapter, "Main-mission batch via director pipeline.");
  if (!plan) return { persisted: false as const, reason: "Mission planner faalde." };
  await insertMainMissionPlan(playerId, record.chapter.id, plan, false);
  await progressCampaign(playerId, { skipIdempotency: true, reason: "main_quest_batch" });
  return { persisted: true as const, payload: plan };
}
