import assert from "node:assert/strict";
import test from "node:test";
import { checkInSendProbability, rollCheckInLottery } from "@/server/domain/nyx/checkIn/lottery";

test("daytime probability exceeds night for same tier", () => {
  const day = checkInSendProbability({ tier: "FRIEND", hoursSilent: 24, isDaytime: true });
  const night = checkInSendProbability({ tier: "FRIEND", hoursSilent: 24, isDaytime: false });
  assert.ok(day > night);
});

test("rollCheckInLottery respects random threshold", () => {
  const p = checkInSendProbability({ tier: "EARLY", hoursSilent: 12, isDaytime: true });
  assert.equal(rollCheckInLottery({ tier: "EARLY", hoursSilent: 12, isDaytime: true, random: 0 }), true);
  assert.equal(
    rollCheckInLottery({ tier: "EARLY", hoursSilent: 12, isDaytime: true, random: p + 0.001 }),
    false,
  );
});

test("trust tier has higher base than early", () => {
  const early = checkInSendProbability({ tier: "EARLY", hoursSilent: 12, isDaytime: true });
  const trust = checkInSendProbability({ tier: "TRUST", hoursSilent: 12, isDaytime: true });
  assert.ok(trust > early);
});
