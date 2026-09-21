import assert from "node:assert/strict";
import test from "node:test";
import { normalizeExitComparator } from "./chapter-skeleton.schema";

test("normalizeExitComparator maps >= to GTE", () => {
  assert.equal(normalizeExitComparator(">="), "GTE");
  assert.equal(normalizeExitComparator("gte"), "GTE");
  assert.equal(normalizeExitComparator("<="), "LTE");
  assert.equal(normalizeExitComparator("="), "EQ");
});
