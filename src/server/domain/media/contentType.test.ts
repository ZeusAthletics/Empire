import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRangedMediaResponse,
  isVideoStoragePath,
  mimeTypeFromStoragePath,
} from "@/server/domain/media/contentType";

test("mimeTypeFromStoragePath prefers video/mp4 for .mp4 paths", () => {
  assert.equal(mimeTypeFromStoragePath("player/id/nyx-outreach.mp4", "application/octet-stream"), "video/mp4");
});

test("isVideoStoragePath detects common extensions", () => {
  assert.equal(isVideoStoragePath("a/b/file.webm"), true);
  assert.equal(isVideoStoragePath("photo.jpg"), false);
});

test("buildRangedMediaResponse returns 206 for range requests", async () => {
  const body = new Uint8Array([0, 1, 2, 3, 4]).buffer;
  const response = buildRangedMediaResponse(body, "x/test.mp4", undefined, "bytes=1-3");
  assert.equal(response.status, 206);
  assert.match(response.headers.get("Content-Type") ?? "", /video\/mp4/);
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
});
