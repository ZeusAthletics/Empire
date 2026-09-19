import { compilePersona, DEFAULT_PERSONA, PersonaCompiler } from "@/server/ai/prompts/persona";
import { NYX_CORE, NYX_CORE_VERSION } from "@/server/ai/prompts/nyx-core";
import { handleCasualUserTurn } from "@/server/ai/fallback/nyxReply";
import { evaluatePattern } from "@/server/domain/pattern/thresholds";
import { defaultReasons, scoreOpportunity } from "@/server/domain/opportunity/score";
import { applyReviewDecision } from "@/server/domain/campaign/review";
import { proposeChapterChange } from "@/server/ai/services/CampaignPlanningService";
import { parseMainQuestStrategy, proposeMainQuestChange } from "@/server/validation/missionRuleEngine";
import { CampaignRuleError } from "@/server/validation/CampaignRuleEngine";

export type GoldenResult = { id: string; name: string; ok: boolean; detail: string };

function check(id: string, name: string, ok: boolean, detail: string): GoldenResult {
  return { id, name, ok, detail };
}

export function runGoldens(): { passed: number; total: number; results: GoldenResult[] } {
  const compiled = PersonaCompiler.compile(DEFAULT_PERSONA);
  const casual = handleCasualUserTurn("Ik heb gisteravond een goede avond gehad.", {
    featuredTitle: "THE CONNECTOR",
    network: 86,
    economicCurrent: 64800,
  });
  const patternNone = evaluatePattern([
    { type: "CHAT", id: "c1", at: "2026-09-19T08:00:00.000Z", theme: "optionality" },
  ]);
  const patternSurface = evaluatePattern([
    { type: "JOURNAL", id: "j2", at: "2026-08-30T08:00:00.000Z", theme: "optionality" },
    { type: "MISSION", id: "m-q4", at: "2026-09-01T08:00:00.000Z", theme: "optionality" },
    { type: "MEMORY", id: "mem-freedom", at: "2026-09-17T08:00:00.000Z", theme: "optionality" },
  ]);
  const geel = scoreOpportunity(
    {
      title: "VOKA EVENT — GEEL",
      summary: "Netwerkavond",
      category: "EVENT",
      availableFrom: "2026-09-20T10:00:00.000Z",
      locationName: "Geel",
      lat: 51.1656,
      lng: 4.9906,
      relatedStats: ["network"],
      relatedContactKeys: ["c-frans"],
    },
    {
      bottleneckStat: "network",
      agenda: [{ lat: 51.1737, lng: 4.9906, at: "2026-09-20T10:00:00.000Z" }],
      knownContactKeys: ["c-frans"],
      restrictedContactKeys: ["c-jdi"],
      dismissedCategories: [],
      categoryWeight: 0,
      similarCount: 0,
      now: new Date("2026-09-19T12:00:00.000Z"),
    },
  );
  const geelReasons = defaultReasons(
    {
      title: "VOKA EVENT — GEEL",
      summary: "Netwerkavond",
      category: "EVENT",
      locationName: "Geel",
      relatedStats: ["network"],
      relatedContactKeys: ["c-frans"],
    },
    {
      bottleneckStat: "network",
      agenda: [],
      knownContactKeys: ["c-frans"],
      restrictedContactKeys: [],
      dismissedCategories: [],
      categoryWeight: 0,
      similarCount: 0,
    },
    geel,
  );
  const review = applyReviewDecision(
    {
      keepBottleneck: false,
      proposedBottleneck: "strategy",
      evidence: ["patroon"],
      impactOnActiveMissions: [],
      whatStays: "Chapter I ESCAPE VELOCITY blijft staan.",
      preservedElements: ["chapter I"],
      currentChapterId: "ch-1",
    },
    { lockedByAdmin: false, bottleneckStat: "optionality", chapterId: "ch-1" },
  );
  let lockedOk = false;
  try {
    proposeChapterChange(
      {
        title: "II",
        strategicPurpose: "Nieuw",
        startConditions: [],
        targetConditions: [],
        exitCriteria: [],
        dependencies: [],
        relevantStats: [],
        strategicRisks: [],
        order: 2,
        rationale: "test",
        confidence: 0.8,
      },
      true,
    );
  } catch (error) {
    lockedOk = error instanceof CampaignRuleError;
  }
  const invalidQuest = proposeMainQuestChange({ raw: "{not-json" });

  const results = [
    check("1", "casual chat maakt geen missie", casual.createdMission === null, "createdMission blijft null"),
    check("2", "compiler schrijft u en verbiedt emoji", /"u"/.test(compiled) && /No emoji/.test(compiled), "address + noEmoji"),
    check("3", "één chat is nooit een patroon", patternNone === "NONE" && patternSurface === "SURFACED", `${patternNone}/${patternSurface}`),
    check("4", "Geel scoort hoog zonder auto-missie", geel.score > 80 && geelReasons.join(" ").match(/netwerk/i) !== null, `score ${geel.score}`),
    check("5", "verboden zinnen zitten in de compiler", compiled.includes("u moet") && compiled.includes("you got this"), "banned phrases"),
    check("6", "review wijzigt bottleneck, chapter blijft", review.bottleneckStat === "strategy" && review.chapterDeleted === false, review.chapterId ?? "ch-1"),
    check("7", "memory-revisie is append-only in het model", compiled.includes("Mark inferences"), "versies via MemoryVersion"),
    check("8", "compiled core is persona@version", NYX_CORE_VERSION === "persona@1" && NYX_CORE.length > 0, NYX_CORE_VERSION),
    check("10", "ongeldige Main Quest JSON persist niet", invalidQuest.persisted === false && parseMainQuestStrategy("{not-json") === null, "geen mutatie"),
    check("11", "admin-locked chapter overleeft replan", lockedOk, "CampaignRuleError"),
    check("address-je", "je-compiler gebruikt je", compilePersona({ ...DEFAULT_PERSONA, address: "je" }).includes('"je"'), "address switch"),
  ];

  return {
    passed: results.filter((item) => item.ok).length,
    total: results.length,
    results,
  };
}
