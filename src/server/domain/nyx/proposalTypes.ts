import type { CampaignReviewPayload } from "@/server/ai/schemas/campaign-review.schema";
import type { StatKey } from "@/server/domain/player/types";
import type { MissionKind, MissionTrack } from "@/server/domain/mission/types";
import type { MemoryProposalPayload } from "@/server/domain/memory/types";
import type { PatternProposalPayload } from "@/server/domain/pattern/types";

export type SideQuestProposalPayload = {
  title: string;
  duration: string;
  difficulty: string;
  xp: number;
  impact: string;
  blueprint: {
    kind: MissionKind;
    track: MissionTrack;
    why: string;
    mainObjective: string;
    objectives: { label: string }[];
    locationName: string;
    lat: number;
    lng: number;
    people: string[];
    estimate: string;
    statReward: { key: StatKey; amount: number };
    evidence: string;
  };
};

export type PublicProposal = {
  id: string;
  seedKey: string | null;
  kind: string;
  status: string;
  rationale: string;
  createdAt?: string;
  confidence?: string;
  importance?: string;
  payload: SideQuestProposalPayload | MemoryProposalPayload | PatternProposalPayload | CampaignReviewPayload | Record<string, unknown>;
};

export function isSideQuestPayload(payload: PublicProposal["payload"]): payload is SideQuestProposalPayload {
  return "title" in payload && "blueprint" in payload;
}

export function isMemoryPayload(payload: PublicProposal["payload"]): payload is MemoryProposalPayload {
  return "normalizedFact" in payload && "domain" in payload;
}

export function isPatternPayload(payload: PublicProposal["payload"]): payload is PatternProposalPayload {
  return "evidenceRefs" in payload && "strategicImpact" in payload && "title" in payload;
}

export function isReviewPayload(payload: PublicProposal["payload"]): payload is CampaignReviewPayload {
  return "whatStays" in payload && "keepBottleneck" in payload;
}
