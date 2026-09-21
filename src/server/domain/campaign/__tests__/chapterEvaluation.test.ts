import assert from "node:assert/strict";
import test from "node:test";
import { evaluateExitCriteria } from "../director/ChapterEvaluationService";

test("STAT GTE criterion met when stat high enough", () => {
  const { allMet, evaluations } = evaluateExitCriteria(
    [
      {
        id: "c1",
        kind: "STAT",
        status: "OPEN",
        statKey: "network",
        comparator: "GTE",
        targetValue: 10,
      },
    ],
    { stats: { network: 12 }, empireValue: 0, completedMainMissionCount: 0 },
  );
  assert.equal(allMet, true);
  assert.equal(evaluations[0]?.nextStatus, "MET");
});

test("MISSION_COUNT and EMPIRE_VALUE must both pass", () => {
  const { allMet } = evaluateExitCriteria(
    [
      {
        id: "m",
        kind: "MISSION_COUNT",
        status: "OPEN",
        statKey: null,
        comparator: "GTE",
        targetValue: 2,
      },
      {
        id: "e",
        kind: "EMPIRE_VALUE",
        status: "OPEN",
        statKey: null,
        comparator: "GTE",
        targetValue: 5000,
      },
    ],
    { stats: {}, empireValue: 4000, completedMainMissionCount: 3 },
  );
  assert.equal(allMet, false);
});

test("MANUAL stays open until waived", () => {
  const open = evaluateExitCriteria(
    [{ id: "x", kind: "MANUAL", status: "OPEN", statKey: null, comparator: null, targetValue: null }],
    { stats: {}, empireValue: 999, completedMainMissionCount: 99 },
  );
  assert.equal(open.allMet, false);

  const waived = evaluateExitCriteria(
    [{ id: "x", kind: "MANUAL", status: "WAIVED", statKey: null, comparator: null, targetValue: null }],
    { stats: {}, empireValue: 0, completedMainMissionCount: 0 },
  );
  assert.equal(waived.allMet, true);
});
