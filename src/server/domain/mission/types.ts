import type { StatKey } from "@/server/domain/player/types";

export type MissionKind = "MAIN" | "BOSS" | "EVENT" | "BUSINESS" | "CONTENT" | "NETWORK" | "OPPORTUNITY";
export type MissionTrack = "MAIN_STORY" | "SIDE_QUEST";
export type MissionStatus =
  | "PROPOSED"
  | "ACTIVE"
  | "BLOCKED"
  | "COMPLETED"
  | "COMPLETED_UNVERIFIED"
  | "ABANDONED"
  | "LOCKED";
export type MissionDifficulty = "LOW" | "MEDIUM" | "HIGH" | "BOSS";
export type ObjectiveStatus = "OPEN" | "COMPLETED" | "SKIPPED";
export type EvidenceKind = "JOURNAL_ENTRY" | "PHOTO" | "CONTACT_LINK" | "DOCUMENT" | "USER_ATTESTED";
export type RecordSource = "AI" | "ADMIN" | "USER";

export type PublicObjective = {
  id: string;
  label: string;
  optional: boolean;
  status: ObjectiveStatus;
};

export type PublicContactRef = {
  id: string;
  name: string;
  role: string | null;
};

export type PublicMission = {
  id: string;
  seedKey: string | null;
  kind: MissionKind;
  track: MissionTrack;
  title: string;
  why: string;
  mainObjective: string;
  status: MissionStatus;
  difficulty: MissionDifficulty;
  estimateLabel: string | null;
  impact: string | null;
  xpReward: number;
  xpGranted: number;
  statReward: { key: StatKey; amount: number };
  evidenceRequirement: string;
  locationName: string | null;
  locationAddress: string | null;
  featured: boolean;
  whenLabel: string | null;
  objectives: PublicObjective[];
  contacts: PublicContactRef[];
};

export function requiredCount(mission: { objectives: PublicObjective[] }) {
  return mission.objectives.filter((objective) => !objective.optional).length;
}

export function doneCount(mission: { objectives: PublicObjective[] }) {
  return mission.objectives.filter((objective) => !objective.optional && objective.status === "COMPLETED").length;
}

export function featuredMission(missions: PublicMission[]): PublicMission | null {
  return missions.find((mission) => mission.status === "ACTIVE" && mission.featured)
    ?? missions.find((mission) => mission.status === "ACTIVE")
    ?? null;
}
