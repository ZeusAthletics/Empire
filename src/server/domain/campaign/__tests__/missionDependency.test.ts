import assert from "node:assert/strict";
import test from "node:test";
import { eligibleToUnlock } from "../director/MissionDependencyService";

test("unlock when prerequisite completed", () => {
  const ids = eligibleToUnlock(
    [
      { id: "a", status: "COMPLETED" },
      { id: "b", status: "LOCKED" },
    ],
    [{ missionId: "b", prerequisiteMissionId: "a" }],
    new Set(["a"]),
  );
  assert.deepEqual(ids, ["b"]);
});

test("no unlock while prerequisite open", () => {
  const ids = eligibleToUnlock(
    [
      { id: "a", status: "ACTIVE" },
      { id: "b", status: "PLANNED" },
    ],
    [{ missionId: "b", prerequisiteMissionId: "a" }],
    new Set<string>(),
  );
  assert.deepEqual(ids, []);
});
