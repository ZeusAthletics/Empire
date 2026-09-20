import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatChatLineForPrompt } from "@/server/domain/nyx/chatFormat";

describe("formatChatLineForPrompt", () => {
  it("appends media context for Nyx outbound media", () => {
    const line = formatChatLineForPrompt({
      role: "NYX",
      content: "Even voor u.",
      media_id: "abc",
      media_context: "Gold latex, dusk Kempen.",
    });
    assert.match(line, /Gold latex/);
    assert.match(line, /Even voor u\./);
  });
});
