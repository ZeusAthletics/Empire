import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCheckInEligibility, MAX_CHECKINS_PER_WEEK, MIN_SILENCE_HOURS } from "@/server/domain/nyx/checkIn/eligibility";

const now = Date.parse("2026-09-21T12:00:00.000Z");

test("requires 12h silence", () => {
  const lastUser = now - 6 * 60 * 60 * 1000;
  const result = evaluateCheckInEligibility({
    nowMs: now,
    lastUserAtMs: lastUser,
    silenceAnchorMs: null,
    lastCheckInAtMs: null,
    checkInsLast7Days: 0,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /12/);
});

test("blocks when check-in already sent after last user message", () => {
  const lastUser = now - 20 * 60 * 60 * 1000;
  const checkIn = now - 2 * 60 * 60 * 1000;
  const result = evaluateCheckInEligibility({
    nowMs: now,
    lastUserAtMs: lastUser,
    silenceAnchorMs: null,
    lastCheckInAtMs: checkIn,
    checkInsLast7Days: 1,
  });
  assert.equal(result.ok, false);
});

test("allows when silence and under weekly cap", () => {
  const lastUser = now - MIN_SILENCE_HOURS * 60 * 60 * 1000 - 1000;
  const result = evaluateCheckInEligibility({
    nowMs: now,
    lastUserAtMs: lastUser,
    silenceAnchorMs: null,
    lastCheckInAtMs: null,
    checkInsLast7Days: MAX_CHECKINS_PER_WEEK - 1,
  });
  assert.equal(result.ok, true);
});

test("blocks at weekly cap", () => {
  const lastUser = now - 48 * 60 * 60 * 1000;
  const result = evaluateCheckInEligibility({
    nowMs: now,
    lastUserAtMs: lastUser,
    silenceAnchorMs: null,
    lastCheckInAtMs: null,
    checkInsLast7Days: MAX_CHECKINS_PER_WEEK,
  });
  assert.equal(result.ok, false);
});
