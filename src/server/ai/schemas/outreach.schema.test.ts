import test from "node:test";
import assert from "node:assert/strict";
import { parseOutreachDecision } from "./outreach.schema";

test("parseOutreachDecision accepts strict null fields", () => {
  const parsed = parseOutreachDecision(
    JSON.stringify({
      action: "PHOTO",
      reason: "aanmoediging",
      caption: "Bon. x",
      scene: null,
      mediaSource: "CURATED",
      curatedMediaId: "abc-123",
    }),
  );
  assert.equal(parsed?.action, "PHOTO");
  assert.equal(parsed?.curatedMediaId, "abc-123");
});
