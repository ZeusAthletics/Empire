import assert from "node:assert/strict";
import test from "node:test";
import { selectPlayable } from "../director/MissionAvailabilityService";

test("caps playable MAIN_STORY at 3", () => {
  const candidates = [1, 2, 3, 4, 5].map((n) => ({
    id: `m${n}`,
    track: "MAIN_STORY",
    status: "PLANNED",
    narrativeOrder: n,
  }));
  const { playableIds } = selectPlayable(candidates, 3);
  assert.equal(playableIds.length, 3);
  assert.deepEqual(playableIds, ["m1", "m2", "m3"]);
});

test("ACTIVE missions count toward cap", () => {
  const { playableIds } = selectPlayable(
    [
      { id: "a", track: "MAIN_STORY", status: "ACTIVE", narrativeOrder: 1 },
      { id: "b", track: "MAIN_STORY", status: "PLANNED", narrativeOrder: 2 },
      { id: "c", track: "MAIN_STORY", status: "PLANNED", narrativeOrder: 3 },
      { id: "d", track: "MAIN_STORY", status: "PLANNED", narrativeOrder: 4 },
    ],
    3,
  );
  assert.equal(playableIds.length, 3);
  assert.ok(playableIds.includes("a"));
});
