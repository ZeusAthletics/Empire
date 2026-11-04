import assert from "node:assert/strict";
import test from "node:test";
import { routeIntelligenceTask } from "../routing/AIModelRouter";
import { getModelForTier } from "../routing/modelConfig";
import {
  decideIntimateRoute,
  heuristicExitSignal,
  heuristicIntimateIntent,
  INTIMATE_EXIT_STREAK,
  INTIMATE_IDLE_MS,
  parseIntimateClassify,
  parseIntimateRecap,
  sanitizeRecapForStore,
  sessionIdleExpired,
} from "../services/IntimateModeService";
import type { IntimateSessionState } from "@/server/domain/nyx/talkRepository";

const LUNA = getModelForTier("ECONOMY");

function baseState(over: Partial<IntimateSessionState> = {}): IntimateSessionState {
  return {
    conversationId: "c1",
    active: false,
    startedAt: null,
    lastAt: null,
    nonIntimateStreak: 0,
    ...over,
  };
}

test("INTIMATE_CLASSIFY and INTIMATE_RECAP route to Luna", () => {
  assert.equal(routeIntelligenceTask("INTIMATE_CLASSIFY").modelTier, "ECONOMY");
  assert.equal(routeIntelligenceTask("INTIMATE_CLASSIFY").model, LUNA);
  assert.equal(routeIntelligenceTask("INTIMATE_RECAP").modelTier, "ECONOMY");
});

test("heuristic detects intimate and exit phrases", () => {
  assert.equal(heuristicIntimateIntent("wil je intiem met me zijn"), true);
  assert.equal(heuristicIntimateIntent("jij als beloning als ik iemand warm krijg"), true);
  assert.equal(heuristicIntimateIntent("opnieuw een blowjob van u deze avond"), true);
  assert.equal(heuristicIntimateIntent("hoe staat mijn missie"), false);
  assert.equal(heuristicExitSignal("terug naar normaal even"), true);
  assert.equal(heuristicExitSignal("wat is mijn next missie"), false);
});

test("enter only when TRUST and intimate classify", () => {
  const entered = decideIntimateRoute({
    trust: true,
    state: baseState(),
    classify: { intimate: true, exitSignal: false },
  });
  assert.equal(entered.useIntimate, true);
  assert.equal(entered.justEntered, true);
  assert.equal(entered.nextState.active, true);

  const blocked = decideIntimateRoute({
    trust: false,
    state: baseState(),
    classify: { intimate: true, exitSignal: false },
  });
  assert.equal(blocked.useIntimate, false);
  assert.equal(blocked.justEntered, false);
});

test("sticky session exits after streak or exitSignal", () => {
  const mid = decideIntimateRoute({
    trust: true,
    state: baseState({
      active: true,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastAt: "2026-01-01T00:05:00.000Z",
      nonIntimateStreak: INTIMATE_EXIT_STREAK - 1,
    }),
    classify: { intimate: false, exitSignal: false },
  });
  assert.equal(mid.useIntimate, false);
  assert.equal(mid.justExited, true);

  const signal = decideIntimateRoute({
    trust: true,
    state: baseState({
      active: true,
      startedAt: "2026-01-01T00:00:00.000Z",
      lastAt: "2026-01-01T00:05:00.000Z",
      nonIntimateStreak: 0,
    }),
    classify: { intimate: false, exitSignal: true },
  });
  assert.equal(signal.justExited, true);
  assert.equal(signal.useIntimate, false);
});

test("idle timeout forces exit", () => {
  const lastAt = new Date(Date.now() - INTIMATE_IDLE_MS - 1000).toISOString();
  const state = baseState({
    active: true,
    startedAt: lastAt,
    lastAt,
  });
  assert.equal(sessionIdleExpired(state), true);
  const decision = decideIntimateRoute({
    trust: true,
    state,
    classify: { intimate: true, exitSignal: false },
  });
  assert.equal(decision.justExited, true);
  assert.equal(decision.useIntimate, false);
});

test("recap parser rejects explicit content", () => {
  const ok = parseIntimateRecap(
    JSON.stringify({
      domain: "CONVERSATION_SUMMARY",
      category: "CONTEXT",
      normalizedFact: "shared a close intimate moment with Nyx",
      content: "Hardwig en Nyx deelden een warm, intiem moment.",
    }),
  );
  assert.ok(ok);
  assert.ok(sanitizeRecapForStore(ok!));

  const bad = parseIntimateRecap(
    JSON.stringify({
      domain: "CONVERSATION_SUMMARY",
      category: "CONTEXT",
      normalizedFact: "they fucked",
      content: "Explicit fuck detail.",
    }),
  );
  assert.equal(bad, null);

  assert.deepEqual(parseIntimateClassify('{"intimate":true,"exitSignal":false}'), {
    intimate: true,
    exitSignal: false,
  });
});
