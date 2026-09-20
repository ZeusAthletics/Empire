import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOutreachDecision } from "@/server/ai/schemas/outreach.schema";
import { hasOutreachHook } from "@/server/domain/nyx/outreach/hooks";

describe("outreach schema", () => {
  it("parses valid silence", () => {
    const parsed = parseOutreachDecision(JSON.stringify({ action: "SILENCE", reason: "Geen hook." }));
    assert.equal(parsed?.action, "SILENCE");
  });

  it("rejects invalid action", () => {
    assert.equal(parseOutreachDecision(JSON.stringify({ action: "SPAM", reason: "x" })), null);
  });
});

describe("outreach hooks", () => {
  it("requires at least one hook", () => {
    assert.equal(hasOutreachHook({ hooks: [], recentChat: [] }), false);
    assert.equal(hasOutreachHook({ hooks: ["Memory: test"], recentChat: [] }), true);
  });
});
