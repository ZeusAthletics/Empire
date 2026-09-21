import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  intimacyTierAtLeast,
  isCuratedIntimacyBlockedReason,
  stricterIntimacyTier,
} from "@/server/domain/nyx/curated/tier";

describe("intimacyTierAtLeast", () => {
  it("orders EARLY < FRIEND < TRUST", () => {
    assert.equal(intimacyTierAtLeast("EARLY", "EARLY"), true);
    assert.equal(intimacyTierAtLeast("EARLY", "FRIEND"), false);
    assert.equal(intimacyTierAtLeast("FRIEND", "EARLY"), true);
    assert.equal(intimacyTierAtLeast("TRUST", "FRIEND"), true);
    assert.equal(intimacyTierAtLeast("FRIEND", "TRUST"), false);
  });

  it("stricterIntimacyTier picks lower band", () => {
    assert.equal(stricterIntimacyTier("FRIEND", "TRUST"), "FRIEND");
    assert.equal(stricterIntimacyTier("TRUST", "EARLY"), "EARLY");
  });

  it("detects tier-blocked curated delivery", () => {
    assert.equal(isCuratedIntimacyBlockedReason("Band te laag voor dit item (min TRUST)."), true);
    assert.equal(isCuratedIntimacyBlockedReason("Curated id onbekend."), false);
  });
});
