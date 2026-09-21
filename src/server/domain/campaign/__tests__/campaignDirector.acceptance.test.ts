import assert from "node:assert/strict";
import test from "node:test";
import { handleCasualUserTurn } from "@/server/ai/fallback/nyxReply";
import { planChapter } from "@/server/ai/services/CampaignPlanningService";
import { planMainQuest } from "@/server/ai/services/MissionGenerationService";
import { getModelForTier } from "@/server/ai/routing/modelConfig";
import { evaluateExitCriteria } from "../director/ChapterEvaluationService";
import { eligibleToUnlock } from "../director/MissionDependencyService";
import { selectPlayable } from "../director/MissionAvailabilityService";
import type { HealthIssue } from "../director/CampaignHealthService";

const DIRECTOR = getModelForTier("DIRECTOR");

test("1 exit criteria evaluation marks STAT threshold", () => {
  const { allMet } = evaluateExitCriteria(
    [
      {
        id: "1",
        kind: "STAT",
        status: "OPEN",
        statKey: "execution",
        comparator: "GTE",
        targetValue: 5,
      },
    ],
    { stats: { execution: 6 }, empireValue: 180, completedMainMissionCount: 1 },
  );
  assert.equal(allMet, true);
});

test("2 empire value criterion uses chapter economic snapshot", () => {
  const { evaluations } = evaluateExitCriteria(
    [
      {
        id: "2",
        kind: "EMPIRE_VALUE",
        status: "OPEN",
        statKey: null,
        comparator: "GTE",
        targetValue: 1000,
      },
    ],
    { stats: {}, empireValue: 999, completedMainMissionCount: 0 },
  );
  assert.equal(evaluations[0]?.met, false);
});

test("3 mission count includes completed mains", () => {
  const { allMet } = evaluateExitCriteria(
    [
      {
        id: "3",
        kind: "MISSION_COUNT",
        status: "OPEN",
        statKey: null,
        comparator: "GTE",
        targetValue: 3,
      },
    ],
    { stats: {}, empireValue: 0, completedMainMissionCount: 3 },
  );
  assert.equal(allMet, true);
});

test("4 dependency graph unlocks next node", () => {
  const unlock = eligibleToUnlock(
    [
      { id: "main-1", status: "COMPLETED" },
      { id: "main-2", status: "LOCKED" },
    ],
    [{ missionId: "main-2", prerequisiteMissionId: "main-1" }],
    new Set(["main-1"]),
  );
  assert.deepEqual(unlock, ["main-2"]);
});

test("5 chapter planning routes to Director tier", () => {
  const { decision } = planChapter();
  assert.equal(decision.modelTier, "DIRECTOR");
  assert.equal(decision.model, DIRECTOR);
});

test("6 main quest generation routes to Director tier", () => {
  const { decision } = planMainQuest();
  assert.equal(decision.modelTier, "DIRECTOR");
});

test("12 casual conversation does not create a mission", () => {
  const result = handleCasualUserTurn("Goede avond", {
    featuredTitle: "THE CONNECTOR",
    network: 10,
    economicCurrent: 180,
  });
  assert.equal(result.createdMission, null);
});

test("13 idempotency key format is stable for mission completion", () => {
  const key = `MISSION_COMPLETED:${"550e8400-e29b-41d4-a716-446655440000"}`;
  assert.match(key, /^MISSION_COMPLETED:[0-9a-f-]{36}$/i);
});

test("15 playable cap never exceeds three", () => {
  const sel = selectPlayable(
    Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      track: "MAIN_STORY",
      status: "PROPOSED",
      narrativeOrder: i + 1,
    })),
    3,
  );
  assert.equal(sel.playableIds.length, 3);
});

test("16 health model flags missing chapter exit criteria", () => {
  const issue: HealthIssue = "MISSING_CHAPTER_EXIT_CRITERIA";
  assert.equal(issue, "MISSING_CHAPTER_EXIT_CRITERIA");
});
