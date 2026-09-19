import type { StatKey } from "@/server/domain/player/types";
import type { MissionKind, MissionTrack } from "@/server/domain/mission/types";
import type { MemoryProposalPayload } from "@/server/domain/memory/types";

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
  payload: SideQuestProposalPayload | MemoryProposalPayload;
};

export function isSideQuestPayload(payload: PublicProposal["payload"]): payload is SideQuestProposalPayload {
  return "title" in payload && "blueprint" in payload;
}

export function isMemoryPayload(payload: PublicProposal["payload"]): payload is MemoryProposalPayload {
  return "normalizedFact" in payload && "domain" in payload;
}
