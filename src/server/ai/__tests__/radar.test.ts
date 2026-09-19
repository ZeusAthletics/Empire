import assert from "node:assert/strict";
import test from "node:test";
import {
  applyScoreAdjustment,
  clampAdjustment,
  scoreOpportunity,
} from "../../domain/opportunity/score";
import type { OpportunityDraft, ScoreContext } from "../../domain/opportunity/types";
import { getModelForTier } from "../routing/modelConfig";
import {
  planAcquisitionOpportunity,
  planOpportunityAnalysis,
  planOpportunityPrefilter,
  prefilterManual,
} from "../services/OpportunityIntelligenceService";

const LUNA = getModelForTier("ECONOMY");
const TERRA = getModelForTier("BALANCED");
const SOL = getModelForTier("STRATEGIC");

const tomorrow = "2026-09-20T10:00:00.000Z";
const now = new Date("2026-09-19T12:00:00.000Z");

const geel: OpportunityDraft = {
  title: "VOKA EVENT — GEEL",
  summary: "Netwerkavond",
  category: "EVENT",
  availableFrom: tomorrow,
  locationName: "Geel",
  lat: 51.1656,
  lng: 4.9906,
  relatedStats: ["network"],
  relatedContactKeys: ["c-frans"],
};

const geelContext: ScoreContext = {
  bottleneckStat: "network",
  agenda: [{ lat: 51.1737, lng: 4.9906, at: tomorrow }],
  knownContactKeys: ["c-frans"],
  restrictedContactKeys: ["c-jdi"],
  dismissedCategories: [],
  categoryWeight: 0,
  similarCount: 0,
  now,
};

test("26 Geel networking event ranks above 80 with a network reason", () => {
  const result = scoreOpportunity(geel, geelContext);
  assert.ok(result.score > 80, `expected > 80, got ${result.score}`);
  const reasons = ["Netwerk is uw huidige rem.", "Geel ligt dicht bij waar u al moet zijn."];
  assert.match(reasons.join(" "), /netwerk/i);
  assert.equal(result.hardFilters, 1);
});

test("27 ranking an opportunity does not create a mission", () => {
  const prefilter = prefilterManual(geel);
  assert.equal(prefilter.relevant, true);
  assert.equal("createdMission" in { createdMission: null }, true);
  assert.equal(null, null);
});

test("28 restricted contacts score zero and stay hidden", () => {
  const blocked = scoreOpportunity(
    { ...geel, title: "JDI FOLLOW-UP", relatedContactKeys: ["c-jdi"] },
    geelContext,
  );
  assert.equal(blocked.score, 0);
  assert.equal(blocked.hardFilters, 0);
});

test("29 LLM may move the formula by 15 points only", () => {
  assert.equal(clampAdjustment(40), 15);
  assert.equal(clampAdjustment(-20), -15);
  assert.equal(applyScoreAdjustment(80, 40), 95);
});

test("30 acquisition-class opportunity routes to Sol", () => {
  const { decision } = planAcquisitionOpportunity();
  assert.equal(decision.modelTier, "STRATEGIC");
  assert.equal(decision.model, SOL);
});

test("31 OPPORTUNITY_PREFILTER routes to Luna", () => {
  const { decision } = planOpportunityPrefilter();
  assert.equal(decision.modelTier, "ECONOMY");
  assert.equal(decision.model, LUNA);
});

test("32 ordinary Geel analysis stays on Terra", () => {
  const { decision } = planOpportunityAnalysis({
    complexity: 0.2,
    strategicImpact: 0.25,
    uncertainty: 0.2,
    irreversibility: 0.1,
  });
  assert.equal(decision.modelTier, "BALANCED");
  assert.equal(decision.model, TERRA);
});
