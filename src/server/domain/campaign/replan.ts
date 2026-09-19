import type { CampaignChangeProposal } from "@/server/ai/schemas/campaign-change.schema";

export const MATERIAL_REPLAN_TRIGGERS = [
  "MAIN_COMPLETED",
  "CHAPTER_COMPLETED",
  "MAJOR_INCOME",
  "CAPITAL",
  "CAREER",
  "BUSINESS",
  "OPPORTUNITY",
  "RISK",
  "STAGNATION",
  "USER_GOAL",
  "ADMIN",
] as const;

export type ReplanTrigger = (typeof MATERIAL_REPLAN_TRIGGERS)[number];

export function isMaterialReplanTrigger(value: string): value is ReplanTrigger {
  return (MATERIAL_REPLAN_TRIGGERS as readonly string[]).includes(value);
}

export function assessCampaignReplan(input: {
  trigger: string;
  lockedByAdmin?: boolean;
  chapterId?: string | null;
  chapterName?: string;
}): { replan: false; keepCampaign: true } | { replan: true; keepCampaign: false; proposal: CampaignChangeProposal } {
  if (input.lockedByAdmin || !isMaterialReplanTrigger(input.trigger)) {
    return { replan: false, keepCampaign: true };
  }
  return {
    replan: true,
    keepCampaign: false,
    proposal: {
      reason: input.trigger,
      affectedChapterIds: input.chapterId ? [input.chapterId] : [],
      affectedMissionIds: [],
      proposedChanges: ["Bottleneck heroverwegen."],
      preservedElements: [
        input.chapterName ? `Chapter ${input.chapterName} blijft staan.` : "Bestaande chapters blijven staan.",
        "Geschiedenis wordt niet verwijderd.",
      ],
      strategicRationale: "Materiële verschuiving. Campagne herijken, historie bewaren.",
      confidence: 0.7,
    },
  };
}
