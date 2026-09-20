import test from "node:test";
import assert from "node:assert/strict";
import { userWantsMediaInChat } from "./NyxChatMediaService";

test("userWantsMediaInChat detects explicit photo ask", () => {
  assert.equal(userWantsMediaInChat("Kan je mij een foto ter aanmoediging sturen? x"), true);
  assert.equal(userWantsMediaInChat("Wat moet ik vandaag doen?"), false);
});
