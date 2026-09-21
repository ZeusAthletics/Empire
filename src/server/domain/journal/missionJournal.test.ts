import assert from "node:assert/strict";
import test from "node:test";
import { buildMissionCompletionBody } from "./missionJournal";

test("buildMissionCompletionBody lists completed objectives", () => {
  const body = buildMissionCompletionBody({
    title: "TEST MISSION",
    mainObjective: "Do the thing.",
    why: "Because.",
    xpReward: 300,
    statReward: { key: "execution", amount: 4 },
    evidenceRequirement: "Photo proof.",
    locationName: "Geel",
    objectives: [
      { label: "Step one", optional: false, status: "COMPLETED" },
      { label: "Optional", optional: true, status: "OPEN" },
    ],
  });
  assert.match(body, /TEST MISSION/);
  assert.match(body, /Step one/);
  assert.doesNotMatch(body, /Optional/);
  assert.match(body, /300 XP/);
});
