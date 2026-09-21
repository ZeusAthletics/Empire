import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMediaDelivery,
  remainingFromBudget,
  startOfUtcDay,
} from "../relationship/mediaBudget";

test("classifyMediaDelivery treats mp4 as video", () => {
  assert.equal(classifyMediaDelivery("nyx/foo/bar.mp4"), "video");
  assert.equal(classifyMediaDelivery("nyx/foo/bar.jpg"), "photo");
});

test("remainingFromBudget never goes negative", () => {
  const left = remainingFromBudget(
    { maxPhotosPerDay: 2, maxVideosPerDay: 1 },
    { photos: 5, videos: 2 },
  );
  assert.equal(left.photosLeft, 0);
  assert.equal(left.videosLeft, 0);
});

test("startOfUtcDay is midnight UTC", () => {
  const d = startOfUtcDay(new Date("2026-09-21T15:30:00.000Z"));
  assert.equal(d.toISOString(), "2026-09-21T00:00:00.000Z");
});
