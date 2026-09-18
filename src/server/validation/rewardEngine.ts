import type { MissionKind } from "@/server/domain/mission/types";

export function effectiveXp(kind: MissionKind, xpReward: number) {
  return kind === "BOSS" ? xpReward * 2 : xpReward;
}

export function xpShareForObjective(effective: number) {
  return Math.floor(effective * 0.2);
}

export class MissionLockedError extends Error {
  constructor() {
    super("Deze missie is vergrendeld.");
    this.name = "MissionLockedError";
  }
}

export class MissionClosedError extends Error {
  constructor() {
    super("Deze missie is al afgerond.");
    this.name = "MissionClosedError";
  }
}

export type RewardObjective = {
  id: string;
  optional: boolean;
  status: "OPEN" | "COMPLETED" | "SKIPPED";
};

export type RewardMission = {
  kind: MissionKind;
  status: "PROPOSED" | "ACTIVE" | "BLOCKED" | "COMPLETED" | "COMPLETED_UNVERIFIED" | "ABANDONED" | "LOCKED";
  xpReward: number;
  xpGranted: number;
  statReward: { key: string; amount: number };
  objectives: RewardObjective[];
};

export type RewardResult = {
  xpDelta: number;
  xpGrantedTotal: number;
  statDelta: { key: string; amount: number } | null;
  missionStatus: RewardMission["status"];
  objectiveStatus: "OPEN" | "COMPLETED" | "SKIPPED";
  completed: boolean;
  unverified: boolean;
};

function required(mission: RewardMission) {
  return mission.objectives.filter((objective) => !objective.optional);
}

function assertOpenForReward(mission: RewardMission) {
  if (mission.status === "LOCKED") throw new MissionLockedError();
  if (mission.status === "COMPLETED" || mission.status === "COMPLETED_UNVERIFIED") {
    throw new MissionClosedError();
  }
}

export function attestObjective(mission: RewardMission, objectiveId: string): RewardResult {
  assertOpenForReward(mission);
  const objective = mission.objectives.find((item) => item.id === objectiveId);
  if (!objective) throw new Error("Objectief niet gevonden.");
  if (objective.status === "COMPLETED") {
    return {
      xpDelta: 0,
      xpGrantedTotal: mission.xpGranted,
      statDelta: null,
      missionStatus: mission.status,
      objectiveStatus: "COMPLETED",
      completed: false,
      unverified: false,
    };
  }

  const cap = effectiveXp(mission.kind, mission.xpReward);
  const share = objective.optional ? 0 : xpShareForObjective(cap);
  const xpDelta = Math.min(share, Math.max(0, cap - mission.xpGranted));
  let xpGrantedTotal = mission.xpGranted + xpDelta;
  objective.status = "COMPLETED";
  mission.xpGranted = xpGrantedTotal;

  const allRequiredDone = required(mission).every((item) => item.status === "COMPLETED");
  if (!allRequiredDone) {
    return {
      xpDelta,
      xpGrantedTotal,
      statDelta: null,
      missionStatus: mission.status,
      objectiveStatus: "COMPLETED",
      completed: false,
      unverified: false,
    };
  }

  const remaining = Math.max(0, cap - xpGrantedTotal);
  xpGrantedTotal += remaining;
  mission.xpGranted = xpGrantedTotal;
  mission.status = "COMPLETED";
  return {
    xpDelta: xpDelta + remaining,
    xpGrantedTotal,
    statDelta: mission.statReward.amount ? mission.statReward : null,
    missionStatus: "COMPLETED",
    objectiveStatus: "COMPLETED",
    completed: true,
    unverified: false,
  };
}

export function completeWithoutEvidence(mission: RewardMission): RewardResult {
  assertOpenForReward(mission);
  mission.status = "COMPLETED_UNVERIFIED";
  return {
    xpDelta: 0,
    xpGrantedTotal: mission.xpGranted,
    statDelta: null,
    missionStatus: "COMPLETED_UNVERIFIED",
    objectiveStatus: "OPEN",
    completed: true,
    unverified: true,
  };
}

export function finalizeMission(mission: RewardMission): RewardResult {
  assertOpenForReward(mission);
  if (!required(mission).every((item) => item.status === "COMPLETED")) {
    throw new Error("Niet alle verplichte objectieven zijn afgevinkt.");
  }
  const cap = effectiveXp(mission.kind, mission.xpReward);
  const remaining = Math.max(0, cap - mission.xpGranted);
  mission.xpGranted += remaining;
  mission.status = "COMPLETED";
  return {
    xpDelta: remaining,
    xpGrantedTotal: mission.xpGranted,
    statDelta: mission.statReward.amount ? mission.statReward : null,
    missionStatus: "COMPLETED",
    objectiveStatus: "COMPLETED",
    completed: true,
    unverified: false,
  };
}

export function applyXpToPlayer(
  player: { xp: number; xpToNext: number; level: number; lifetimeXp: number },
  xpDelta: number,
) {
  const next = { ...player };
  next.xp += xpDelta;
  next.lifetimeXp += xpDelta;
  while (next.xpToNext > 0 && next.xp >= next.xpToNext) {
    next.xp -= next.xpToNext;
    next.level += 1;
  }
  return next;
}
