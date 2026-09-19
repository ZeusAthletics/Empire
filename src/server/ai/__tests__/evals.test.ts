import assert from "node:assert/strict";
import test from "node:test";
import { compilePersona, DEFAULT_PERSONA, PersonaCompiler } from "../prompts/persona";
import { NYX_CORE_VERSION } from "../prompts/nyx-core";
import { runGoldens } from "../evals/goldens";

test("PersonaCompiler uses u and bans emoji", () => {
  const text = PersonaCompiler.compile(DEFAULT_PERSONA);
  assert.match(text, /"u"/);
  assert.match(text, /No emoji/);
  assert.match(text, /No exclamation marks/);
  assert.doesNotMatch(text, /😀|🎉/);
});

test("PersonaCompiler address switch", () => {
  const text = compilePersona({ ...DEFAULT_PERSONA, address: "je" });
  assert.match(text, /"je"/);
});

test("nyx-core exports compiled persona@version", () => {
  assert.equal(NYX_CORE_VERSION, "persona@1");
});

test("architecture goldens including 10 and 11", () => {
  const suite = runGoldens();
  assert.equal(suite.passed, suite.total, suite.results.filter((item) => !item.ok).map((item) => item.name).join(", "));
});
