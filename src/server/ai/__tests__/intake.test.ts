import assert from "node:assert/strict";
import test from "node:test";
import { routeIntelligenceTask } from "../routing/AIModelRouter";
import { getModelForTier } from "../routing/modelConfig";
import { handleCasualUserTurn } from "../fallback/nyxReply";
import { draftIntakeFromTranscript } from "../services/IntakeConfirmService";
import { summarizePlayerModel } from "../../domain/player/playerModel";
import { DEFAULT_STAT_WEIGHTS } from "../../domain/player/types";
import { afterLoginPath, playerNeedsIntake } from "../../auth/intakeGate";
import type { SessionPlayer } from "../../domain/player/types";

const TERRA = getModelForTier("BALANCED");

test("PLAYER_INTAKE routes to Terra", () => {
  const decision = routeIntelligenceTask("PLAYER_INTAKE");
  assert.equal(decision.modelTier, "BALANCED");
  assert.equal(decision.model, TERRA);
});

test("casual conversation still does not create a mission", () => {
  const result = handleCasualUserTurn("Maak een missie", {
    featuredTitle: "geen",
    network: 0,
    economicCurrent: 0,
  });
  assert.equal(result.createdMission, null);
});

test("intake compile does not insert missions; it only drafts proposals", () => {
  const draft = draftIntakeFromTranscript(
    "U: Ik werk vroeg, bouw merken, en wil over twaalf maanden uit de uren zijn. Empire staat op 12000 euro.\nNyx: Genoteerd.",
  );
  assert.ok(draft.campaign.northStar.length > 0);
  assert.ok(draft.constraints.some((item) => /JDI/i.test(item)));
  assert.equal(draft.campaign.economicCurrent, 12000);
  assert.ok(draft.missions.length >= 1);
  assert.equal(draft.missions[0]?.blueprint.people.length, 0);
});

test("unconfirmed Hardwig is sent to intake, not home", () => {
  const player = {
    id: "p1",
    authUserId: "a1",
    displayName: "HARDWIG AERTS",
    title: "OPERATOR",
    role: "PLAYER" as const,
    level: 1,
    xp: 0,
    xpToNext: 1000,
    lifetimeXp: 0,
    homeAddress: null,
    intakeCompletedAt: null,
    stats: [],
  } satisfies SessionPlayer;
  assert.equal(playerNeedsIntake(player), true);
  assert.equal(afterLoginPath(player), "/intake");
  assert.equal(afterLoginPath(null), "/intake");
  assert.equal(afterLoginPath({ ...player, role: "ADMIN", intakeCompletedAt: null }), "/admin");
  assert.equal(
    afterLoginPath({ ...player, intakeCompletedAt: "2026-09-19T12:00:00.000Z" }),
    "/home",
  );
});

test("player model summary includes constraints for the generator", () => {
  const summary = summarizePlayerModel({
    playerId: "p1",
    weights: DEFAULT_STAT_WEIGHTS,
    principles: ["Bewijs voor belofte"],
    constraints: ["Nooit JDI-relaties benaderen."],
    energyGivers: ["Vroege ochtend"],
    energyDrains: ["Eindeloze calls"],
    version: 1,
    updatedAt: "",
  });
  assert.ok(summary);
  assert.match(summary ?? "", /JDI/);
  assert.match(summary ?? "", /Vroege ochtend/);
});
