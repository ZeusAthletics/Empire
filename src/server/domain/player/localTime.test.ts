import assert from "node:assert/strict";
import test from "node:test";
import {
  DAYTIME_END_HOUR,
  DAYTIME_START_HOUR,
  formatPlayerLocalTime,
  isValidTimeZone,
  normalizePlayerTimeZone,
} from "@/server/domain/player/localTime";

test("normalizePlayerTimeZone falls back for invalid", () => {
  assert.equal(normalizePlayerTimeZone("Not/AZone"), "Europe/Brussels");
  assert.equal(normalizePlayerTimeZone("Europe/Brussels"), "Europe/Brussels");
});

test("isValidTimeZone accepts IANA ids", () => {
  assert.equal(isValidTimeZone("Europe/Brussels"), true);
  assert.equal(isValidTimeZone(""), false);
});

test("formatPlayerLocalTime daytime window", () => {
  const noon = new Date("2026-09-21T10:00:00.000Z");
  const local = formatPlayerLocalTime("Europe/Brussels", noon);
  assert.equal(local.timeZone, "Europe/Brussels");
  assert.equal(typeof local.isDaytime, "boolean");
  if (local.hour >= DAYTIME_START_HOUR && local.hour < DAYTIME_END_HOUR) {
    assert.equal(local.isDaytime, true);
  }
});
