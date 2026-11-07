import assert from "node:assert/strict";
import test from "node:test";
import { pullReadySentences } from "@/server/ai/phone/sentenceFlush";

test("holds partial sentence until terminator", () => {
  const first = pullReadySentences("Hey Hardwig, ik", { final: false });
  assert.equal(first.sentences.length, 0);
  assert.match(first.rest, /Hey Hardwig/);

  const second = pullReadySentences("Hey Hardwig, ik hoor je. En nog", { final: false });
  assert.deepEqual(second.sentences, ["Hey Hardwig, ik hoor je."]);
  assert.equal(second.rest, "En nog");
});

test("flushes remainder on final", () => {
  const result = pullReadySentences("Nog even dit", { final: true });
  assert.deepEqual(result.sentences, ["Nog even dit"]);
  assert.equal(result.rest, "");
});
