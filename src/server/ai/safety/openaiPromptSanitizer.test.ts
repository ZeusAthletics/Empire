import assert from "node:assert/strict";
import test from "node:test";
import {
  containsExplicitContent,
  OPENAI_INTIMATE_REDACT_PLACEHOLDER,
  redactChatLineForOpenAI,
  sanitizeOpenAITaskText,
} from "./openaiPromptSanitizer";

test("detects explicit lexicon", () => {
  assert.equal(containsExplicitContent("gewoon werk"), false);
  assert.equal(containsExplicitContent("ik ben geil op jou"), true);
});

test("redacts chat lines for OpenAI", () => {
  const safe = redactChatLineForOpenAI("NYX: je missie staat klaar");
  assert.equal(safe, "NYX: je missie staat klaar");
  const redacted = redactChatLineForOpenAI("USER: ik wil je neuken");
  assert.match(redacted, /Gemaskeerd/);
  assert.equal(redacted.includes("neuken"), false);
});

test("sanitize recap transcript block", () => {
  const raw = `Guide\n\nTranscript (intern):\nUSER: hallo\nNYX: kom hier geil ding`;
  const out = sanitizeOpenAITaskText("INTIMATE_RECAP", raw);
  assert.match(out, /Sommige beurten zijn gemaskeerd/);
  assert.match(out, OPENAI_INTIMATE_REDACT_PLACEHOLDER);
  assert.equal(out.includes("geil ding"), false);
});

test("sanitize classify player turn", () => {
  const out = sanitizeOpenAITaskText(
    "INTIMATE_CLASSIFY",
    "Spelerbeurt:\nlaat me je kont zien",
  );
  assert.match(out, /Spelerbericht bevat intieme/);
  assert.equal(out.includes("kont"), false);
});
