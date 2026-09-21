import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { generateChapterSkeleton } from "@/server/ai/services/ChapterPlanner";
import type { ChapterProposal } from "@/server/ai/schemas/chapter.schema";
import { parseChapterSkeletonPlan } from "@/server/ai/schemas/chapter-skeleton.schema";
import {
  applySkeletonPlan,
  replaceExitCriteriaFromPlan,
} from "@/server/domain/campaign/chapterRepository";
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

export async function runChapterPipeline(playerId: string, rawPlan: string | ChapterProposal) {
  const record = await getCampaignRecord(playerId);
  if (!record?.chapter) return { persisted: false as const, reason: "Geen actief hoofdstuk." };
  const locked = Boolean(record.chapter.locked_by_admin);

  if (typeof rawPlan === "string") {
    const plan = parseChapterSkeletonPlan(rawPlan);
    if (!plan) return { persisted: false as const, reason: "Ongeldig chapter-skeleton JSON." };
    await applySkeletonPlan(record.chapter, plan);
    await replaceExitCriteriaFromPlan(playerId, record.chapter.id, plan, locked);
    return { persisted: true as const, payload: plan };
  }

  try {
    const result = proposeChapterChange(rawPlan, locked);
    const generated = await generateChapterSkeleton(playerId, record.chapter, "replan");
    if (generated) {
      await applySkeletonPlan(record.chapter, generated);
      await replaceExitCriteriaFromPlan(playerId, record.chapter.id, generated, locked);
    }
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
