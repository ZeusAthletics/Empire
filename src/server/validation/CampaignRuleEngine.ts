import type { ChapterProposal } from "@/server/ai/schemas/chapter.schema";

export class CampaignRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignRuleError";
  }
}

export function validateChapterProposal(proposal: ChapterProposal, lockedByAdmin = false) {
  if (lockedByAdmin) {
    throw new CampaignRuleError("Admin-locked chapter mag niet worden overschreven.");
  }
  if (!proposal.title.trim() || !proposal.strategicPurpose.trim()) {
    throw new CampaignRuleError("Chapter-voorstel is onvolledig.");
  }
  if (proposal.confidence < 0 || proposal.confidence > 1) {
    throw new CampaignRuleError("Chapter-confidence is ongeldig.");
  }
}
