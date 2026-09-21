export type PlayableCandidate = {
  id: string;
  track: string;
  status: string;
  narrativeOrder: number | null;
};

export type PlayableSelection = {
  playableIds: string[];
  demoteToLocked: string[];
  demoteToPlanned: string[];
};

const PLAYABLE = new Set(["PROPOSED", "ACTIVE"]);

/** Pick up to max playable MAIN_STORY missions; demote overflow and non-selected LOCKED/PLANNED. */
export function selectPlayable(candidates: PlayableCandidate[], max = 3): PlayableSelection {
  const mains = candidates
    .filter((m) => m.track === "MAIN_STORY")
    .sort((a, b) => (a.narrativeOrder ?? 999) - (b.narrativeOrder ?? 999));

  const alreadyActive = mains.filter((m) => m.status === "ACTIVE");
  const proposedOrLocked = mains.filter((m) => m.status !== "ACTIVE");

  const playableIds: string[] = [];
  for (const m of alreadyActive) playableIds.push(m.id);

  for (const m of proposedOrLocked) {
    if (playableIds.length >= max) break;
    if (m.status === "PLANNED" || m.status === "LOCKED" || m.status === "PROPOSED") {
      playableIds.push(m.id);
    }
  }

  const playableSet = new Set(playableIds);
  const demoteToLocked: string[] = [];
  const demoteToPlanned: string[] = [];

  for (const m of mains) {
    if (playableSet.has(m.id)) continue;
    if (PLAYABLE.has(m.status) || m.status === "LOCKED") demoteToLocked.push(m.id);
    else if (m.status === "PROPOSED") demoteToLocked.push(m.id);
    else demoteToPlanned.push(m.id);
  }

  return { playableIds, demoteToLocked, demoteToPlanned };
}
