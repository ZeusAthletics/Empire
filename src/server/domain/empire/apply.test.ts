import assert from "node:assert/strict";
import test from "node:test";
import { applyEmpireDelta, EmpireValueError, parseEmpireDelta } from "./apply";

test("plus and min deltas move empire value both ways", () => {
  assert.equal(applyEmpireDelta(64800, 2500), 67300);
  assert.equal(applyEmpireDelta(64800, -800), 64000);
});

test("zero or empty change is rejected", () => {
  assert.throws(() => parseEmpireDelta(0, "plus"), EmpireValueError);
  assert.throws(() => parseEmpireDelta("", "plus"), EmpireValueError);
});

test("min sign always stores a negative integer", () => {
  assert.equal(parseEmpireDelta(1200, "min"), -1200);
  assert.equal(parseEmpireDelta(-1200, "plus"), 1200);
});
