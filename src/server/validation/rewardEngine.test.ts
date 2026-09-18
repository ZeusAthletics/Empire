import assert from "node:assert/strict";
import test from "node:test";
import {
  applyXpToPlayer,
  attestObjective,
  completeWithoutEvidence,
  effectiveXp,
  MissionLockedError,
  type RewardMission,
} from "./rewardEngine";

function mission(overrides: Partial<RewardMission> = {}): RewardMission {
  return {
    kind: "EVENT",
    status: "ACTIVE",
    xpReward: 250,
    xpGranted: 0,
    statReward: { key: "network", amount: 3 },
    objectives: [
      { id: "o1", optional: false, status: "OPEN" },
      { id: "o2", optional: false, status: "OPEN" },
      { id: "o3", optional: false, status: "OPEN" },
      { id: "o4", optional: true, status: "OPEN" },
    ],
    ...overrides,
  };
}

test("VOKA listed reward is 250 XP", () => {
  assert.equal(effectiveXp("EVENT", 250), 250);
});

test("attesting an objective grants 20% XP", () => {
  const result = attestObjective(mission(), "o1");
  assert.equal(result.xpDelta, 50);
  assert.equal(result.completed, false);
  assert.equal(result.missionStatus, "ACTIVE");
});

test("completing all required objectives grants remaining XP and stat reward", () => {
  const state = mission();
  attestObjective(state, "o1");
  attestObjective(state, "o2");
  const result = attestObjective(state, "o3");
  assert.equal(result.completed, true);
  assert.equal(result.xpDelta, 150);
  assert.equal(result.xpGrantedTotal, 250);
  assert.deepEqual(result.statDelta, { key: "network", amount: 3 });
  assert.equal(result.missionStatus, "COMPLETED");
});

test("optional objectives do not grant XP", () => {
  const result = attestObjective(mission({ xpGranted: 50 }), "o4");
  assert.equal(result.xpDelta, 0);
  assert.equal(result.completed, false);
});

test("mission without evidence completes unverified with 0 XP", () => {
  const result = completeWithoutEvidence(mission());
  assert.equal(result.xpDelta, 0);
  assert.equal(result.unverified, true);
  assert.equal(result.missionStatus, "COMPLETED_UNVERIFIED");
});

test("locked boss cannot be attested", () => {
  assert.throws(
    () => attestObjective(mission({ kind: "BOSS", status: "LOCKED", xpReward: 1000 }), "o1"),
    MissionLockedError,
  );
});

test("boss missions pay double XP", () => {
  const state = mission({
    kind: "BOSS",
    xpReward: 100,
    objectives: [
      { id: "o1", optional: false, status: "OPEN" },
      { id: "o2", optional: false, status: "OPEN" },
    ],
  });
  const first = attestObjective(state, "o1");
  assert.equal(first.xpDelta, 40);
  const done = attestObjective(state, "o2");
  assert.equal(done.xpGrantedTotal, 200);
  assert.equal(done.completed, true);
});

test("player XP rolls into the next level", () => {
  const player = applyXpToPlayer({ xp: 900, xpToNext: 1000, level: 1, lifetimeXp: 900 }, 150);
  assert.equal(player.level, 2);
  assert.equal(player.xp, 50);
  assert.equal(player.lifetimeXp, 1050);
});
