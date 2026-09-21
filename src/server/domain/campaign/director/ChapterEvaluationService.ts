import type { StatKey } from "@/server/domain/player/types";

export type ExitCriterionKind = "STAT" | "EMPIRE_VALUE" | "MISSION_COUNT" | "MANUAL";
export type ExitComparator = "GTE" | "LTE" | "EQ";
export type ExitCriterionStatus = "OPEN" | "MET" | "WAIVED";

export type EvaluableCriterion = {
  id: string;
  kind: ExitCriterionKind;
  status: ExitCriterionStatus;
  statKey: StatKey | null;
  comparator: ExitComparator | null;
  targetValue: number | null;
};

export type ChapterProgressSnapshot = {
  stats: Partial<Record<StatKey, number>>;
  empireValue: number;
  completedMainMissionCount: number;
};

export type CriterionEvaluation = {
  id: string;
  met: boolean;
  nextStatus: ExitCriterionStatus;
};

function compare(actual: number, target: number, comparator: ExitComparator): boolean {
  if (comparator === "GTE") return actual >= target;
  if (comparator === "LTE") return actual <= target;
  return actual === target;
}

export function evaluateExitCriteria(
  criteria: EvaluableCriterion[],
  snapshot: ChapterProgressSnapshot,
): { allMet: boolean; evaluations: CriterionEvaluation[] } {
  const evaluations: CriterionEvaluation[] = [];

  for (const row of criteria) {
    if (row.status === "MET" || row.status === "WAIVED") {
      evaluations.push({ id: row.id, met: true, nextStatus: row.status });
      continue;
    }

    let met = false;
    if (row.kind === "MANUAL") {
      met = false;
    } else if (row.kind === "EMPIRE_VALUE" && row.comparator != null && row.targetValue != null) {
      met = compare(snapshot.empireValue, row.targetValue, row.comparator);
    } else if (row.kind === "MISSION_COUNT" && row.comparator != null && row.targetValue != null) {
      met = compare(snapshot.completedMainMissionCount, row.targetValue, row.comparator);
    } else if (row.kind === "STAT" && row.statKey && row.comparator != null && row.targetValue != null) {
      const actual = snapshot.stats[row.statKey] ?? 0;
      met = compare(actual, row.targetValue, row.comparator);
    }

    evaluations.push({
      id: row.id,
      met,
      nextStatus: met ? "MET" : "OPEN",
    });
  }

  const allMet = evaluations.every((item) => item.met);
  return { allMet, evaluations };
}
