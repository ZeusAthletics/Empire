export type DependencyEdge = {
  missionId: string;
  prerequisiteMissionId: string;
};

export type MissionLockState = {
  id: string;
  status: string;
};

/** Missions whose prerequisites are all completed and that are still LOCKED or PLANNED. */
export function eligibleToUnlock(
  missions: MissionLockState[],
  edges: DependencyEdge[],
  completedIds: Set<string>,
): string[] {
  const byMission = new Map<string, string[]>();
  for (const edge of edges) {
    const list = byMission.get(edge.missionId) ?? [];
    list.push(edge.prerequisiteMissionId);
    byMission.set(edge.missionId, list);
  }

  const eligible: string[] = [];
  for (const mission of missions) {
    if (mission.status !== "LOCKED" && mission.status !== "PLANNED") continue;
    const prereqs = byMission.get(mission.id) ?? [];
    if (prereqs.length === 0) {
      eligible.push(mission.id);
      continue;
    }
    if (prereqs.every((id) => completedIds.has(id))) eligible.push(mission.id);
  }
  return eligible;
}
