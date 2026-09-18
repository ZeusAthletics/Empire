import assert from "node:assert/strict";
import test from "node:test";
import { assertNoRestrictedTargets, RestrictedContactError } from "./missionRuleEngine";

test("missions may target ordinary contacts", () => {
  assert.doesNotThrow(() =>
    assertNoRestrictedTargets(
      [
        { id: "c-pieter", restricted: false },
        { id: "c-jdi", restricted: true },
      ],
      ["c-pieter"],
    ),
  );
});

test("missions may not target a restricted contact", () => {
  assert.throws(
    () =>
      assertNoRestrictedTargets(
        [
          { id: "c-pieter", restricted: false },
          { id: "c-jdi", restricted: true },
        ],
        ["c-jdi"],
      ),
    RestrictedContactError,
  );
});
