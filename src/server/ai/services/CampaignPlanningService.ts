import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { ChapterProposal } from "@/server/ai/schemas/chapter.schema";
import { assessCampaignReplan } from "@/server/domain/campaign/replan";
import { getCampaignRecord } from "@/server/domain/campaign/review";
import { createCampaignReviewProposal } from "@/server/domain/nyx/proposalRepository";
import { CampaignRuleError, validateChapterProposal } from "@/server/validation/CampaignRuleEngine";

export function planChapter() {
  return planNyxTask({ task: "CHAPTER_PLANNING" });
}

export function planCampaignReplan() {
  return planNyxTask({ task: "CAMPAIGN_REPLAN" });
}

export function proposeChapterChange(proposal: ChapterProposal, lockedByAdmin = false) {
  validateChapterProposal(proposal, lockedByAdmin);
  return { persisted: true as const, payload: proposal };
}

export async function runChapterPipeline(playerId: string, proposal: ChapterProposal) {
  const record = await getCampaignRecord(playerId);
  const locked = Boolean(record?.chapter?.locked_by_admin);
  try {
    const result = proposeChapterChange(proposal, locked);
    return result;
  } catch (error) {
    if (error instanceof CampaignRuleError) return { persisted: false as const, reason: error.message };
    throw error;
  }
}

export async function runCampaignReplan(playerId: string, trigger: string) {
  const record = await getCampaignRecord(playerId);
  const decision = assessCampaignReplan({
    trigger,
    lockedByAdmin: Boolean(record?.campaign.locked_by_admin),
    chapterId: record?.chapter?.id ?? null,
    chapterName: record?.chapter ? `${record.chapter.roman} ${record.chapter.name}` : undefined,
  });
  if (!decision.replan) return decision;
  await createCampaignReviewProposal(
    playerId,
    {
      keepBottleneck: true,
      proposedBottleneck: record?.campaign.bottleneck_stat ?? null,
      evidence: [decision.proposal.strategicRationale],
      impactOnActiveMissions: [],
      whatStays: decision.proposal.preservedElements.join(" "),
      preservedElements: decision.proposal.preservedElements,
      currentChapterId: record?.chapter?.id ?? null,
    },
    decision.proposal.reason,
  );
  return decision;
}
