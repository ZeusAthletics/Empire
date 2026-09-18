export type CampaignChangeProposal = {
  reason: string;
  affectedChapterIds: string[];
  affectedMissionIds: string[];
  proposedChanges: string[];
  preservedElements: string[];
  strategicRationale: string;
  confidence: number;
};
