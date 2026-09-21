import assert from "node:assert/strict";
import test from "node:test";
import { pairNyxChatTurns } from "../historyTurns";

test("pairNyxChatTurns pairs USER with following NYX and skips SYSTEM", () => {
  const turns = pairNyxChatTurns([
    { id: "s1", role: "SYSTEM", content: "welkom", createdAt: "2026-01-01T00:00:00Z" },
    { id: "u1", role: "USER", content: "Ik drink liever koffie dan thee", createdAt: "2026-01-01T00:01:00Z" },
    { id: "n1", role: "NYX", content: "Genoteerd.", createdAt: "2026-01-01T00:01:01Z" },
    { id: "u2", role: "USER", content: "hoi", createdAt: "2026-01-01T00:02:00Z" },
    { id: "n2", role: "NYX", content: "Hey.", createdAt: "2026-01-01T00:02:01Z" },
  ]);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].userMessageId, "u1");
  assert.equal(turns[0].nyxText, "Genoteerd.");
});
