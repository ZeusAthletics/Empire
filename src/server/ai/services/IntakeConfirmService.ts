import { openaiConfigured } from "@/server/ai/client/openai";
import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { INTAKE_COMPILE_SCHEMA, type IntakeCompile } from "@/server/ai/schemas/intake.schema";
import { createCampaignFromIntake } from "@/server/domain/campaign/createFromIntake";
import { insertMemory } from "@/server/domain/memory/repository";
import type { MemoryDomain } from "@/server/domain/memory/types";
import { intakeTranscript } from "@/server/domain/nyx/intakeRepository";
import { createSideQuestProposal } from "@/server/domain/nyx/proposalRepository";
import type { SideQuestProposalPayload } from "@/server/domain/nyx/proposalTypes";
import { upsertPlayerModel } from "@/server/domain/player/playerModel";
import { completeIntake } from "@/server/domain/player/repository";
import { STAT_KEYS, type StatKey } from "@/server/domain/player/types";
import type { MissionKind, MissionTrack } from "@/server/domain/mission/types";

const DOMAINS = new Set<MemoryDomain>([
  "PERSONAL",
  "CAMPAIGN",
  "STRATEGIC",
  "RELATIONSHIP",
  "PREFERENCE",
  "CONVERSATION_SUMMARY",
]);

const KINDS = new Set<MissionKind>(["MAIN", "BOSS", "EVENT", "BUSINESS", "CONTENT", "NETWORK", "OPPORTUNITY"]);
const TRACKS = new Set<MissionTrack>(["MAIN_STORY", "SIDE_QUEST"]);

function asStat(value: unknown): StatKey {
  return STAT_KEYS.includes(value as StatKey) ? (value as StatKey) : "optionality";
}

function parseEuro(text: string): number {
  const match = text.replace(/\./g, "").match(/(\d[\d\s]*)/);
  if (!match) return 0;
  return Math.max(0, Number(match[1].replace(/\s/g, "")) || 0);
}

function fallbackCompile(transcript: string): IntakeCompile {
  const current = parseEuro(transcript);
  return {
    title: "OPERATOR",
    principles: ["Alleen wat hij zelf zei, telt."],
    constraints: ["Nooit JDI-relaties benaderen."],
    energyGivers: [],
    energyDrains: [],
    memories: [
      {
        domain: "STRATEGIC",
        category: "NORTH_STAR",
        fact: "Intake afgerond. Missies volgen uit dit gesprek, niet uit seed.",
      },
    ],
    campaign: {
      title: current ? `€${current} → groei` : "Hoofdstuk I",
      northStar: "Een eigen pad, niet het pad van een ander.",
      bottleneckStat: "optionality",
      bottleneckReason: "Nog te weinig paden naast het huidige werk.",
      chapterName: "HOOFDSTUK I",
      chapterTagline: "Eerst het profiel. Dan de missies.",
      economicCurrent: current,
      economicTo: Math.max(100000, current * 2),
      exitCriteria: "Het eerste meetbare doel is gehaald.",
    },
    missions: [
      {
        title: "EERSTE HEFBOOM",
        duration: "90 min",
        difficulty: "MEDIUM",
        xp: 400,
        impact: "Zet de north star om in één meetbare actie deze week.",
        blueprint: {
          kind: "MAIN",
          track: "MAIN_STORY",
          why: "Zonder één concrete eerste zet blijft het profiel een intentie.",
          mainObjective: "Kies één actie die deze week bewijs levert voor uw doel.",
          objectives: [{ label: "Schrijf het doel in één zin." }, { label: "Zet één afspraak of levering in de agenda." }],
          locationName: "Home Base",
          locationAddress: "",
          people: [],
          estimate: "90 min",
          statReward: { key: "execution", amount: 4 },
          evidence: "Een afspraak of levering met datum.",
        },
      },
    ],
  };
}

function sanitizeMission(raw: SideQuestProposalPayload, index: number): SideQuestProposalPayload | null {
  const title = (raw.title ?? "").trim();
  if (!title) return null;
  const blueprint = raw.blueprint;
  if (!blueprint?.why || !blueprint.mainObjective) return null;
  const kind = KINDS.has(blueprint.kind) ? blueprint.kind : index === 0 ? "MAIN" : "NETWORK";
  const track = TRACKS.has(blueprint.track) ? blueprint.track : index === 0 ? "MAIN_STORY" : "SIDE_QUEST";
  return {
    title: title.toUpperCase(),
    duration: raw.duration || "60 min",
    difficulty: raw.difficulty || "MEDIUM",
    xp: Math.max(50, Math.round(Number(raw.xp) || 300)),
    impact: raw.impact || blueprint.why,
    blueprint: {
      kind,
      track,
      why: blueprint.why,
      mainObjective: blueprint.mainObjective,
      objectives: (blueprint.objectives ?? []).slice(0, 5).map((item) => ({ label: item.label })),
      locationName: blueprint.locationName || "België",
      locationAddress: blueprint.locationAddress || "",
      people: [],
      estimate: blueprint.estimate || raw.duration || "60 min",
      statReward: {
        key: asStat(blueprint.statReward?.key),
        amount: Math.max(1, Math.round(Number(blueprint.statReward?.amount) || 3)),
      },
      evidence: blueprint.evidence || "Een bewijsstuk met datum.",
    },
  };
}

function parseCompile(raw: string | null, transcript: string): IntakeCompile {
  const fallback = fallbackCompile(transcript);
  if (!raw) return fallback;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as IntakeCompile;
    const missions = (parsed.missions ?? [])
      .map((mission, index) => sanitizeMission(mission, index))
      .filter((item): item is SideQuestProposalPayload => Boolean(item))
      .slice(0, 4);
    return {
      title: (parsed.title ?? fallback.title).trim() || fallback.title,
      principles: (parsed.principles ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
      constraints: [
        "Nooit JDI-relaties benaderen.",
        ...(parsed.constraints ?? []).map((item) => item.trim()).filter(Boolean),
      ].slice(0, 8),
      energyGivers: (parsed.energyGivers ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
      energyDrains: (parsed.energyDrains ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
      memories: (parsed.memories ?? [])
        .map((item) => ({
          domain: DOMAINS.has(item.domain) ? item.domain : "PERSONAL",
          category: item.category || "INTAKE",
          fact: (item.fact ?? "").trim(),
        }))
        .filter((item) => item.fact)
        .slice(0, 8),
      campaign: {
        ...fallback.campaign,
        ...parsed.campaign,
        bottleneckStat: asStat(parsed.campaign?.bottleneckStat),
        economicCurrent: Math.max(0, Math.round(Number(parsed.campaign?.economicCurrent) || fallback.campaign.economicCurrent)),
        economicTo: Math.max(10000, Math.round(Number(parsed.campaign?.economicTo) || fallback.campaign.economicTo)),
      },
      missions: missions.length ? missions : fallback.missions,
    };
  } catch {
    return fallback;
  }
}

export async function confirmIntake(playerId: string): Promise<{ next: "/home"; missionCount: number }> {
  const transcript = await intakeTranscript(playerId);
  if (!transcript.includes("U:")) throw new Error("Beantwoord Nyx eerst. Anders is er geen profiel om te bevestigen.");

  const live = openaiConfigured()
    ? await runNyxTask({
        playerId,
        task: "TARGET_STATE_ANALYSIS",
        text: `Compileer het intake-gesprek tot een bevestigd profiel. Alleen feiten die de speler zelf zei. Constraints bevatten altijd: nooit JDI-relaties benaderen. Missions: 1 MAIN_STORY + 2 SIDE_QUEST als SIDE_QUEST-voorstellen. people blijft leeg tot er contacten zijn. locationAddress alleen als hij een echt Belgisch adres noemde.\n\n${transcript}`,
        invokeModel: true,
        jsonSchema: INTAKE_COMPILE_SCHEMA as unknown as Record<string, unknown>,
      }).catch(() => null)
    : null;

  const compiled = parseCompile(live?.text ?? null, transcript);

  await upsertPlayerModel(playerId, {
    principles: compiled.principles,
    constraints: compiled.constraints,
    energyGivers: compiled.energyGivers,
    energyDrains: compiled.energyDrains,
  });

  for (const memory of compiled.memories) {
    await insertMemory(
      playerId,
      {
        domain: memory.domain,
        category: memory.category,
        content: memory.fact,
        normalizedFact: memory.fact,
        confidence: "EXPLICIT",
        importance: memory.domain === "STRATEGIC" ? "HIGH" : "MEDIUM",
        sourceType: "CHAT",
        userConfirmed: true,
      },
      "USER",
      "Intake bevestigd.",
    ).catch(() => undefined);
  }

  await createCampaignFromIntake(playerId, compiled.campaign);
  await completeIntake(playerId, compiled.title);

  for (const mission of compiled.missions) {
    await createSideQuestProposal(playerId, mission, mission.blueprint.why);
  }

  return { next: "/home", missionCount: compiled.missions.length };
}

export function draftIntakeFromTranscript(transcript: string, raw: string | null = null): IntakeCompile {
  return parseCompile(raw, transcript);
}
