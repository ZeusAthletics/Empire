import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intimacyTierAtLeast } from "@/server/domain/nyx/curated/tier";

describe("intimacyTierAtLeast", () => {
  it("orders EARLY < FRIEND < TRUST", () => {
    assert.equal(intimacyTierAtLeast("EARLY", "EARLY"), true);
    assert.equal(intimacyTierAtLeast("EARLY", "FRIEND"), false);
    assert.equal(intimacyTierAtLeast("FRIEND", "EARLY"), true);
    assert.equal(intimacyTierAtLeast("TRUST", "FRIEND"), true);
  });
});
