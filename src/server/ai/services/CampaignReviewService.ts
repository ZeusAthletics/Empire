import { planNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import type { CampaignReviewPayload } from "@/server/ai/schemas/campaign-review.schema";
import { getCampaignRecord } from "@/server/domain/campaign/review";
import { createCampaignReviewProposal } from "@/server/domain/nyx/proposalRepository";
import { listOpenPatterns } from "@/server/domain/pattern/repository";

export function planCampaignReview() {
  return planNyxTask({ task: "CAMPAIGN_REVIEW" });
}

export function shouldRequestCampaignReview(input: {
  confirmedHighPattern?: boolean;
  chapterCompleted?: boolean;
  statShift30d?: number;
  manual?: boolean;
}) {
  if (input.manual) return true;
  if (input.chapterCompleted) return true;
  if ((input.statShift30d ?? 0) >= 10) return true;
  if (input.confirmedHighPattern) return true;
  return false;
}

export async function maybeProposeCampaignReview(playerId: string, manual = false) {
  const record = await getCampaignRecord(playerId);
  if (!record) return { created: false };
  const patterns = await listOpenPatterns(playerId).catch((): Awaited<ReturnType<typeof listOpenPatterns>> => []);
  const confirmedHigh = patterns.some(
    (pattern) =>
      pattern.status === "CONFIRMED" && (pattern.strategicImpact === "HIGH" || pattern.strategicImpact === "CRITICAL"),
  );
  if (
    !shouldRequestCampaignReview({
      confirmedHighPattern: confirmedHigh,
      chapterCompleted: record.chapter?.status === "COMPLETED",
      manual,
    })
  ) {
    return { created: false };
  }

  const payload: CampaignReviewPayload = {
    keepBottleneck: false,
    proposedBottleneck: "strategy",
    evidence: ["Review na een bevestigd patroon of materiële verschuiving."],
    impactOnActiveMissions: [],
    whatStays: record.chapter
      ? `Chapter ${record.chapter.roman} ${record.chapter.name} blijft staan.`
      : "Bestaande chapters blijven staan.",
    preservedElements: ["chapter", "north star", "geschiedenis"],
    currentChapterId: record.chapter?.id ?? null,
  };
  await createCampaignReviewProposal(playerId, payload, "Campagne-review. Niets wordt stil gewijzigd.");
  return { created: true };
}
