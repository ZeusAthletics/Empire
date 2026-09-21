import {
  doneCount,
  requiredCount,
  type MissionStatus,
  type MissionTrack,
  type PublicMission,
} from "@/server/domain/mission/types";

const PLAYABLE_STATUSES = new Set<MissionStatus>(["ACTIVE", "PROPOSED", "BLOCKED", "LOCKED"]);

export type NyxActiveMissionBrief = {
  id: string;
  title: string;
  track: MissionTrack;
  status: MissionStatus;
  progress: string;
  nextStep: string | null;
  featured: boolean;
  mainObjective: string;
};

export function isPlayableMission(mission: PublicMission): boolean {
  return PLAYABLE_STATUSES.has(mission.status);
}

export function briefActiveMission(mission: PublicMission): NyxActiveMissionBrief {
  const next = mission.objectives.find((objective) => !objective.optional && objective.status === "OPEN");
  return {
    id: mission.id,
    title: mission.title,
    track: mission.track,
    status: mission.status,
    progress: `${doneCount(mission)}/${requiredCount(mission)}`,
    nextStep: next?.label ?? null,
    featured: mission.featured,
    mainObjective: mission.mainObjective,
  };
}

export function activeMissionsForNyx(missions: PublicMission[]): {
  mainStory: NyxActiveMissionBrief[];
  sideQuests: NyxActiveMissionBrief[];
} {
  const open = missions.filter(isPlayableMission);
  return {
    mainStory: open.filter((mission) => mission.track === "MAIN_STORY").map(briefActiveMission),
    sideQuests: open.filter((mission) => mission.track === "SIDE_QUEST").map(briefActiveMission),
  };
}

export function formatActiveMissionsForPrompt(active: {
  mainStory: NyxActiveMissionBrief[];
  sideQuests: NyxActiveMissionBrief[];
}): string {
  const lines: string[] = [];
  for (const mission of active.mainStory) {
    const next = mission.nextStep ? ` · volgende stap: ${mission.nextStep}` : "";
    lines.push(`[Hoofdverhaal] ${mission.title} (${mission.status}, ${mission.progress} taken)${next}`);
  }
  for (const mission of active.sideQuests) {
    const next = mission.nextStep ? ` · volgende stap: ${mission.nextStep}` : "";
    lines.push(`[Side quest] ${mission.title} (${mission.status}, ${mission.progress} taken)${next}`);
  }
  if (!lines.length) return "Actieve missies: geen open missies op dit moment.";
  return `Actieve missies (main + side — gebruik alleen wanneer het helpt):\n${lines.join("\n")}`;
}
