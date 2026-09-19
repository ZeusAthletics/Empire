import assert from "node:assert/strict";
import test from "node:test";

function plateShowsImage(src?: string, approved?: boolean) {
  return Boolean(src && approved);
}

test("unapproved or missing mission media stays a gradient plate", () => {
  assert.equal(plateShowsImage(undefined, true), false);
  assert.equal(plateShowsImage("/api/media/x", false), false);
  assert.equal(plateShowsImage("/api/media/x", true), true);
});
