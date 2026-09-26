import type { StatKey } from "@/server/domain/player/types";

export type MissionKind = "MAIN" | "BOSS" | "EVENT" | "BUSINESS" | "CONTENT" | "NETWORK" | "OPPORTUNITY";
export type MissionTrack = "MAIN_STORY" | "SIDE_QUEST";
export type MissionStatus =
  | "PLANNED"
  | "PROPOSED"
  | "ACTIVE"
  | "BLOCKED"
  | "COMPLETED"
  | "COMPLETED_UNVERIFIED"
  | "ABANDONED"
  | "LOCKED"
  | "ARCHIVED";
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
  coverSrc: string | null;
  coverApproved: boolean;
};

export function requiredCount(mission: { objectives: PublicObjective[] }) {
  return mission.objectives.filter((objective) => !objective.optional).length;
}

export function doneCount(mission: { objectives: PublicObjective[] }) {
  return mission.objectives.filter((objective) => !objective.optional && objective.status === "COMPLETED").length;
}

const FEATURED_STATUSES = new Set<MissionStatus>(["ACTIVE", "PROPOSED", "PLANNED", "BLOCKED", "LOCKED"]);

export function featuredMission(missions: PublicMission[]): PublicMission | null {
  const open = missions.filter((mission) => FEATURED_STATUSES.has(mission.status));
  if (!open.length) return null;

  const pick = (pred: (mission: PublicMission) => boolean) => open.find(pred);

  return (
    pick((mission) => mission.status === "ACTIVE" && mission.featured) ??
    pick((mission) => mission.status === "ACTIVE" && mission.track === "MAIN_STORY") ??
    pick((mission) => mission.status === "ACTIVE") ??
    pick((mission) => mission.featured && mission.track === "MAIN_STORY") ??
    pick((mission) => mission.track === "MAIN_STORY") ??
    pick((mission) => mission.featured) ??
    open[0]
  );
}
