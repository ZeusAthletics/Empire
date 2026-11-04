import { openaiConfigured } from "@/server/ai/client/openai";
import { callXaiChat, getXaiModel, xaiConfigured } from "@/server/ai/client/xai";
import { buildNyxContext } from "@/server/ai/context/NyxContextBuilder";
import { writeNyxRun } from "@/server/ai/orchestrator/nyxRuns";
import { loadNyxCore } from "@/server/ai/prompts/nyx-core";
import {
  NYX_INTIMATE_CHAT_GUIDE,
  NYX_INTIMATE_CLASSIFY_GUIDE,
  NYX_INTIMATE_RECAP_GUIDE,
} from "@/server/ai/prompts/nyx-intimate";
import { planNyxTask, runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import {
  INTIMATE_CLASSIFY_JSON_SCHEMA,
  INTIMATE_RECAP_JSON_SCHEMA,
  type IntimateClassifyResult,
  type IntimateRecapResult,
} from "@/server/ai/schemas/intimate.schema";
import { stripModelNames } from "@/server/ai/fallback/nyxReply";
import { insertMemory } from "@/server/domain/memory/repository";
import { normalizeMemoryCategory } from "@/server/domain/memory/categories";
import { normalizeFact } from "@/server/validation/MemoryValidationService";
import {
  getIntimateSessionState,
  recentIntimateTurnTexts,
  setIntimateSessionState,
  type IntimateSessionState,
} from "@/server/domain/nyx/talkRepository";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import { randomUUID } from "node:crypto";

/** Idle sticky session ends after this many ms without an intimate turn. */
export const INTIMATE_IDLE_MS = 60 * 60 * 1000;
/** Exit after this many consecutive non-intimate turns while sticky. */
export const INTIMATE_EXIT_STREAK = 2;

const INTIMATE_LEXICON =
  /\b(seks|sex|geil|nat|hard|klaarkomen|klaar\s*komen|neuken|neuk|orgasme|orgasm|cum|lick|zuigen|pijpen|vinger|kont|borsten|tepels|naakt|naked|horny|aroused|wet\s+for|fuck\s+me|make\s+love|liefdesdaad|intiem|intimate|erotisch|erotic|dirty\s+talk|rolplay|roleplay)\b/i;

const EXIT_LEXICON =
  /\b(terug\s+naar\s+normaal|genoeg|later\s+hierover|missie|mission|werk|work|agenda|check[- ]?in|side\s*quest|hoofdverhaal|niet\s+nu|stop\s+ermee|cool\s*down)\b/i;

/** Explicit body/act language that must not land in AUTO memory. */
const EXPLICIT_RECAP_BLOCK =
  /\b(neuk|fuck|cum|klaarkom|orgasm|pijp|zuig|kontgat|kut|pik|lul|penis|vagina|sperma|sperma|dick|pussy|anal|blowjob|handjob)\b/i;

export function heuristicIntimateIntent(text: string): boolean {
  return INTIMATE_LEXICON.test(text.trim());
}

export function heuristicExitSignal(text: string): boolean {
  return EXIT_LEXICON.test(text.trim());
}

export function parseIntimateClassify(raw: string | null | undefined): IntimateClassifyResult | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<IntimateClassifyResult>;
    if (typeof parsed.intimate !== "boolean" || typeof parsed.exitSignal !== "boolean") return null;
    return { intimate: parsed.intimate, exitSignal: parsed.exitSignal };
  } catch {
    return null;
  }
}

export function parseIntimateRecap(raw: string | null | undefined): IntimateRecapResult | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<IntimateRecapResult>;
    if (parsed.domain !== "CONVERSATION_SUMMARY" && parsed.domain !== "RELATIONSHIP") return null;
    const normalizedFact = String(parsed.normalizedFact ?? "").trim();
    const content = String(parsed.content ?? "").trim();
    if (!normalizedFact || !content) return null;
    if (EXPLICIT_RECAP_BLOCK.test(normalizedFact) || EXPLICIT_RECAP_BLOCK.test(content)) return null;
    const category = normalizeMemoryCategory(parsed.domain, String(parsed.category ?? "CONTEXT"));
    return { domain: parsed.domain, category, normalizedFact, content };
  } catch {
    return null;
  }
}

export function sanitizeRecapForStore(recap: IntimateRecapResult): IntimateRecapResult | null {
  if (EXPLICIT_RECAP_BLOCK.test(recap.normalizedFact) || EXPLICIT_RECAP_BLOCK.test(recap.content)) return null;
  const fact = normalizeFact(recap.normalizedFact) || recap.normalizedFact.trim();
  const content = recap.content.trim().slice(0, 280);
  if (!fact || !content) return null;
  return { ...recap, normalizedFact: fact, content };
}

export function sessionIdleExpired(state: IntimateSessionState, now = Date.now()): boolean {
  if (!state.active || !state.lastAt) return false;
  const last = Date.parse(state.lastAt);
  if (Number.isNaN(last)) return false;
  return now - last > INTIMATE_IDLE_MS;
}

export type IntimateRouteDecision = {
  useIntimate: boolean;
  justEntered: boolean;
  justExited: boolean;
  sessionStartedAt: string | null;
};

/**
 * Pure sticky-session transition given classify labels.
 * Caller persists DB updates.
 */
export function decideIntimateRoute(input: {
  trust: boolean;
  state: IntimateSessionState;
  classify: IntimateClassifyResult;
  now?: Date;
}): IntimateRouteDecision & { nextState: IntimateSessionState } {
  const nowIso = (input.now ?? new Date()).toISOString();
  const state = input.state;

  if (!input.trust) {
    return {
      useIntimate: false,
      justEntered: false,
      justExited: state.active,
      sessionStartedAt: state.startedAt,
      nextState: {
        ...state,
        active: false,
        nonIntimateStreak: 0,
        startedAt: null,
      },
    };
  }

  if (state.active && sessionIdleExpired(state, (input.now ?? new Date()).getTime())) {
    return {
      useIntimate: false,
      justEntered: false,
      justExited: true,
      sessionStartedAt: state.startedAt,
      nextState: { ...state, active: false, nonIntimateStreak: 0, startedAt: null },
    };
  }

  if (state.active) {
    if (input.classify.intimate) {
      return {
        useIntimate: true,
        justEntered: false,
        justExited: false,
        sessionStartedAt: state.startedAt,
        nextState: { ...state, active: true, lastAt: nowIso, nonIntimateStreak: 0 },
      };
    }
    const streak = state.nonIntimateStreak + 1;
    const exit = input.classify.exitSignal || streak >= INTIMATE_EXIT_STREAK;
    if (exit) {
      return {
        useIntimate: false,
        justEntered: false,
        justExited: true,
        sessionStartedAt: state.startedAt,
        nextState: { ...state, active: false, nonIntimateStreak: 0, startedAt: null },
      };
    }
    return {
      useIntimate: true,
      justEntered: false,
      justExited: false,
      sessionStartedAt: state.startedAt,
      nextState: { ...state, active: true, lastAt: nowIso, nonIntimateStreak: streak },
    };
  }

  if (input.classify.intimate && !input.classify.exitSignal) {
    return {
      useIntimate: true,
      justEntered: true,
      justExited: false,
      sessionStartedAt: nowIso,
      nextState: { ...state, active: true, startedAt: nowIso, lastAt: nowIso, nonIntimateStreak: 0 },
    };
  }

  return {
    useIntimate: false,
    justEntered: false,
    justExited: false,
    sessionStartedAt: null,
    nextState: state,
  };
}

export async function classifyIntimateTurn(input: {
  playerId: string;
  userText: string;
}): Promise<IntimateClassifyResult> {
  const heuristic: IntimateClassifyResult = {
    intimate: heuristicIntimateIntent(input.userText),
    exitSignal: heuristicExitSignal(input.userText),
  };

  if (!openaiConfigured()) return heuristic;

  const live = await runNyxTask({
    playerId: input.playerId,
    task: "INTIMATE_CLASSIFY",
    text: `${NYX_INTIMATE_CLASSIFY_GUIDE}\n\nSpelerbeurt:\n${input.userText}`,
    invokeModel: true,
    jsonSchema: INTIMATE_CLASSIFY_JSON_SCHEMA as unknown as Record<string, unknown>,
  }).catch(() => null);

  return parseIntimateClassify(live?.text) ?? heuristic;
}

export async function runIntimateChat(input: {
  playerId: string;
  userText: string;
  recentChat: string[];
  localLine: string;
  attachmentNote?: string;
}): Promise<{ text: string; runId: string | null; fallbackUsed: boolean }> {
  if (!xaiConfigured()) {
    return {
      text: "Ik wil hier graag bij blijven, maar die lijn staat even uit. Zeg het zo meteen opnieuw — of we houden het bij tekst zonder die schakeling.",
      runId: null,
      fallbackUsed: true,
    };
  }

  const requestId = randomUUID();
  const decision = planNyxTask({ task: "INTIMATE_CHAT", text: input.userText }).decision;
  const context = await buildNyxContext(input.playerId, "INTIMATE_CHAT", input.userText.trim());
  const { core, version } = await loadNyxCore();
  const started = Date.now();
  const prompt = `${core}\n\n${version}\nTaak: INTIMATE_CHAT\nContext: ${JSON.stringify(context)}\n\n${input.localLine ? `${input.localLine}\n` : ""}Recente beurten:\n${input.recentChat.join("\n")}\n\nHardwig: ${input.userText}${input.attachmentNote ?? ""}\n\n${NYX_INTIMATE_CHAT_GUIDE}`;

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let success = true;
  let errorMessage: string | undefined;
  let fallbackUsed = false;

  try {
    const result = await callXaiChat({
      model: getXaiModel(),
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: input.userText },
      ],
    });
    text = stripModelNames(result.text);
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  } catch (error) {
    success = false;
    fallbackUsed = true;
    errorMessage = error instanceof Error ? error.message : "Grok-call mislukt.";
    text =
      "Even vast — ik bleef hangen op die beurt. Zeg het nog eens, of we pakken het rustiger op.";
  }

  let runId: string | null = null;
  try {
    runId = await writeNyxRun({
      playerId: input.playerId,
      requestId,
      decision: { ...decision, model: getXaiModel(), reason: `${decision.reason}; provider xAI` },
      latencyMs: Date.now() - started,
      inputTokens,
      outputTokens,
      success,
      fallbackUsed,
      structuredOutputValid: null,
      error: errorMessage,
      promptVersion: version,
    });
  } catch {
    runId = null;
  }

  return { text, runId, fallbackUsed };
}

export async function writeIntimateRecapMemory(input: {
  playerId: string;
  conversationId: string;
  sessionStartedAt: string | null;
  sourceId?: string | null;
}): Promise<void> {
  const turns = await recentIntimateTurnTexts(input.conversationId, input.sessionStartedAt, 30).catch(
    () => [] as string[],
  );
  if (!turns.length) return;

  let recap: IntimateRecapResult | null = null;
  if (openaiConfigured()) {
    const live = await runNyxTask({
      playerId: input.playerId,
      task: "INTIMATE_RECAP",
      text: `${NYX_INTIMATE_RECAP_GUIDE}\n\nTranscript (intern):\n${turns.join("\n")}`,
      invokeModel: true,
      jsonSchema: INTIMATE_RECAP_JSON_SCHEMA as unknown as Record<string, unknown>,
    }).catch(() => null);
    recap = parseIntimateRecap(live?.text);
  }

  if (!recap) {
    recap = {
      domain: "CONVERSATION_SUMMARY",
      category: "CONTEXT",
      normalizedFact: "had an intimate closeness moment with Nyx",
      content: "Hardwig en Nyx deelden een intiem, nabij moment; sfeer was warm en persoonlijk.",
    };
  }

  const safe = sanitizeRecapForStore(recap);
  if (!safe) return;

  await insertMemory(
    input.playerId,
    {
      domain: safe.domain,
      category: safe.category,
      content: safe.content,
      normalizedFact: safe.normalizedFact,
      confidence: "LIKELY",
      importance: "MEDIUM",
      sourceType: "CHAT",
      sourceId: input.sourceId ?? null,
    },
    "AI",
    "Intimate session recap.",
  ).catch(() => undefined);
}

export async function resolveIntimateTurn(input: {
  playerId: string;
  conversationId: string;
  userText: string;
  intimacyTier: IntimacyTier;
}): Promise<IntimateRouteDecision> {
  const state = await getIntimateSessionState(input.conversationId);
  const trust = input.intimacyTier === "TRUST";

  let classify: IntimateClassifyResult;
  if (!trust && !state.active) {
    classify = {
      intimate: heuristicIntimateIntent(input.userText),
      exitSignal: false,
    };
  } else if (trust || state.active) {
    classify = await classifyIntimateTurn({ playerId: input.playerId, userText: input.userText });
  } else {
    classify = { intimate: false, exitSignal: false };
  }

  const decision = decideIntimateRoute({ trust, state, classify });
  await setIntimateSessionState(input.conversationId, {
    active: decision.nextState.active,
    startedAt: decision.nextState.startedAt,
    lastAt: decision.nextState.lastAt,
    nonIntimateStreak: decision.nextState.nonIntimateStreak,
  });

  return {
    useIntimate: decision.useIntimate,
    justEntered: decision.justEntered,
    justExited: decision.justExited,
    sessionStartedAt: decision.sessionStartedAt,
  };
}

export function softRedirectBelowTrust(): string {
  return "Dat voelt te vroeg voor hoe dicht we nu staan. Ik blijf graag dichtbij — laten we dit opbouwen, niet forceren.";
}
