import assert from "node:assert/strict";
import test from "node:test";
import {
  activeMissionsForNyx,
  formatActiveMissionsForPrompt,
  isPlayableMission,
} from "@/server/domain/mission/nyxContext";
import type { PublicMission } from "@/server/domain/mission/types";

function mission(partial: Partial<PublicMission> & Pick<PublicMission, "title" | "track" | "status">): PublicMission {
  return {
    id: "m1",
    seedKey: null,
    kind: "MAIN",
    why: "why",
    mainObjective: "Doel",
    difficulty: "MEDIUM",
    estimateLabel: null,
    impact: null,
    xpReward: 100,
    xpGranted: 0,
    statReward: { key: "execution", amount: 1 },
    evidenceRequirement: "",
    locationName: null,
    locationAddress: null,
    featured: false,
    whenLabel: null,
    objectives: [
      { id: "o1", label: "Stap één", optional: false, status: "COMPLETED" },
      { id: "o2", label: "Stap twee", optional: false, status: "OPEN" },
    ],
    contacts: [],
    coverSrc: null,
    coverApproved: false,
    ...partial,
  };
}

test("isPlayableMission excludes completed missions", () => {
  assert.equal(isPlayableMission(mission({ title: "A", track: "MAIN_STORY", status: "ACTIVE" })), true);
  assert.equal(isPlayableMission(mission({ title: "B", track: "SIDE_QUEST", status: "COMPLETED" })), false);
});

test("activeMissionsForNyx splits main story and side quests", () => {
  const active = activeMissionsForNyx([
    mission({ id: "1", title: "Hoofd", track: "MAIN_STORY", status: "ACTIVE" }),
    mission({ id: "2", title: "Side", track: "SIDE_QUEST", status: "LOCKED" }),
    mission({ id: "3", title: "Klaar", track: "MAIN_STORY", status: "COMPLETED" }),
  ]);
  assert.equal(active.mainStory.length, 1);
  assert.equal(active.mainStory[0]?.title, "Hoofd");
  assert.equal(active.mainStory[0]?.nextStep, "Stap twee");
  assert.equal(active.sideQuests.length, 1);
  assert.equal(active.sideQuests[0]?.title, "Side");
});

test("formatActiveMissionsForPrompt lists tracks", () => {
  const text = formatActiveMissionsForPrompt({
    mainStory: [
      {
        id: "1",
        title: "Jachtgebied",
        track: "MAIN_STORY",
        status: "ACTIVE",
        progress: "0/5",
        nextStep: "Eerste contact",
        featured: true,
        mainObjective: "X",
      },
    ],
    sideQuests: [],
  });
  assert.match(text, /Hoofdverhaal.*Jachtgebied/);
  assert.match(text, /Eerste contact/);
});
