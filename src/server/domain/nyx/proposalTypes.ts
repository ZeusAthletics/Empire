import type { StatKey } from "@/server/domain/player/types";
import type { MissionDifficulty, MissionKind, MissionTrack } from "@/server/domain/mission/types";

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
  payload: SideQuestProposalPayload;
};
