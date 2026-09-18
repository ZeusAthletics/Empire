import type { MissionDifficulty, MissionKind, MissionStatus, MissionTrack, PublicMission } from "@/server/domain/mission/types";
import type { PlateKind } from "@/components/ui/Plate";

export const KIND_LABEL: Record<MissionKind, string> = {
  MAIN: "Main story",
  BOSS: "Boss",
  EVENT: "Event",
  BUSINESS: "Business",
  CONTENT: "Content",
  NETWORK: "Network",
  OPPORTUNITY: "Opportunity",
};

export const TRACK_LABEL: Record<MissionTrack, string> = {
  MAIN_STORY: "Main story",
  SIDE_QUEST: "Side quest",
};

export const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  BOSS: "Boss",
};

export const STATUS_LABEL: Record<MissionStatus, string> = {
  PROPOSED: "Voorgesteld",
  ACTIVE: "Actief",
  BLOCKED: "Geblokkeerd",
  COMPLETED: "Voltooid",
  COMPLETED_UNVERIFIED: "Voltooid zonder bewijs",
  ABANDONED: "Losgelaten",
  LOCKED: "Vergrendeld",
};

export function firstSentence(text: string) {
  const part = text.split(".")[0]?.trim() ?? text;
  return part.endsWith(".") ? part : `${part}.`;
}

export function missionAccent(kind: MissionKind) {
  if (kind === "BOSS" || kind === "CONTENT") return "var(--coral)";
  if (kind === "EVENT") return "var(--jade)";
  return "var(--gold)";
}

export function missionPlate(kind: MissionKind): PlateKind {
  if (kind === "EVENT") return "city";
  if (kind === "CONTENT") return "note";
  if (kind === "NETWORK") return "meet";
  return "mission";
}

export function difficultyTag(difficulty: MissionDifficulty) {
  if (difficulty === "LOW") return "alt";
  if (difficulty === "HIGH") return "warn";
  if (difficulty === "BOSS") return "risk";
  return "";
}

export function statusTag(status: MissionStatus) {
  if (status === "COMPLETED" || status === "COMPLETED_UNVERIFIED" || status === "LOCKED") return "alt";
  return "";
}

export function progressLabel(mission: PublicMission) {
  if (mission.whenLabel) return mission.whenLabel;
  const required = mission.objectives.filter((objective) => !objective.optional).length;
  const done = mission.objectives.filter((objective) => !objective.optional && objective.status === "COMPLETED").length;
  return `${done}/${required} taken`;
}
