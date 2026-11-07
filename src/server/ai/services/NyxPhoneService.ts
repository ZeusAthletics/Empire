import { randomUUID } from "crypto";
import {
  audioToBase64,
  ElevenLabsQuotaError,
  elevenLabsConfigured,
  getElevenLabsCreditStatus,
  synthesizeElevenLabsSpeech,
  synthesizeElevenLabsSpeechStream,
  type ElevenCreditLevel,
} from "@/server/ai/client/elevenlabs";
import { openaiConfigured, streamOpenAIResponsesText } from "@/server/ai/client/openai";
import { getXaiModel, xaiConfigured, callXaiChat, streamXaiChat } from "@/server/ai/client/xai";
import { transcribeAudioWithWhisper } from "@/server/ai/client/whisper";
import { stripModelNames } from "@/server/ai/fallback/nyxReply";
import { planNyxTask, runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { buildNyxContext } from "@/server/ai/context/NyxContextBuilder";
import { pullReadySentences } from "@/server/ai/phone/sentenceFlush";
import { loadNyxCore } from "@/server/ai/prompts/nyx-core";
import { writeNyxRun } from "@/server/ai/orchestrator/nyxRuns";
import {
  sanitizeNyxContextForOpenAI,
  sanitizeOpenAITaskText,
  sanitizePersonaCoreForOpenAI,
} from "@/server/ai/safety/openaiPromptSanitizer";
import {
  heuristicIntimateIntent,
  recentChatSuggestsIntimate,
  resolveIntimateTurn,
  softRedirectBelowTrust,
} from "@/server/ai/services/IntimateModeService";
import { NYX_INTIMATE_CHAT_GUIDE } from "@/server/ai/prompts/nyx-intimate";
import {
  NYX_PHONE_CHAT_GUIDE,
  NYX_PHONE_LOW_CREDIT_OPENER,
  NYX_PHONE_RECAP_GUIDE,
} from "@/server/ai/prompts/nyx-phone";
import { formatActiveMissionsForPrompt } from "@/server/domain/mission/nyxContext";
import { insertMemory } from "@/server/domain/memory/repository";
import type { MemoryDomain } from "@/server/domain/memory/types";
import { resolvePlayerIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import {
  appendPhoneTurn,
  createPhoneCall,
  endPhoneCall,
  formatPhoneTurnsForPrompt,
  getPhoneCall,
  listPhoneTurns,
} from "@/server/domain/nyx/phoneRepository";
import { recentPlayerChatTurns } from "@/server/domain/nyx/recentChat";
import { featuredTalkContext, listDisplayedNyxConversationIds } from "@/server/domain/nyx/talkRepository";
import { findPlayerById } from "@/server/domain/player/repository";
import { formatPlayerLocalTime, formatPlayerLocalTimeLine } from "@/server/domain/player/localTime";

export type PhoneTurnStreamEvent =
  | { type: "user"; text: string }
  | { type: "nyx_partial"; text: string }
  | { type: "audio"; text: string; audioBase64: string }
  | { type: "done"; nyxText: string; creditLevel: ElevenCreditLevel }
  | { type: "error"; error: string; creditEmpty?: boolean };

const PHONE_FALLBACK = "Ik hoor je — even kort vast. Zeg het nog eens.";

function scrubPhoneSpeech(text: string): string {
  return stripModelNames(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\*[^*]+\*/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[#*_`>~]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function dialNyxPhone(playerId: string): Promise<{
  canAnswer: boolean;
  creditLevel: ElevenCreditLevel;
  remaining: number;
  callId: string | null;
  openerAudioBase64: string | null;
  openerText: string | null;
}> {
  if (!elevenLabsConfigured()) {
    return {
      canAnswer: false,
      creditLevel: "empty",
      remaining: 0,
      callId: null,
      openerAudioBase64: null,
      openerText: null,
    };
  }

  const credits = await getElevenLabsCreditStatus(true).catch(() => ({
    level: "empty" as const,
    canSpeak: false,
    remaining: 0,
    limit: 0,
    used: 0,
  }));

  const { primaryId } = await listDisplayedNyxConversationIds(playerId);

  if (!credits.canSpeak || credits.level === "empty") {
    await createPhoneCall({
      playerId,
      conversationId: primaryId,
      creditLevel: "empty",
      status: "MISSED",
    }).catch(() => undefined);
    return {
      canAnswer: false,
      creditLevel: "empty",
      remaining: credits.remaining,
      callId: null,
      openerAudioBase64: null,
      openerText: null,
    };
  }

  const call = await createPhoneCall({
    playerId,
    conversationId: primaryId,
    creditLevel: credits.level,
    status: "ACTIVE",
  });

  let openerAudioBase64: string | null = null;
  let openerText: string | null = null;
  if (credits.level === "low") {
    openerText = NYX_PHONE_LOW_CREDIT_OPENER;
    try {
      const audio = await synthesizeElevenLabsSpeech(openerText);
      openerAudioBase64 = audioToBase64(audio);
      await appendPhoneTurn({
        callId: call.id,
        playerId,
        role: "NYX",
        content: openerText,
      });
    } catch (error) {
      if (error instanceof ElevenLabsQuotaError) {
        await endPhoneCall(playerId, call.id, "QUOTA");
        return {
          canAnswer: false,
          creditLevel: "empty",
          remaining: 0,
          callId: null,
          openerAudioBase64: null,
          openerText: null,
        };
      }
      openerText = null;
      openerAudioBase64 = null;
    }
  }

  return {
    canAnswer: true,
    creditLevel: credits.level,
    remaining: credits.remaining,
    callId: call.id,
    openerAudioBase64,
    openerText,
  };
}

async function preparePhoneReply(input: {
  playerId: string;
  conversationId: string;
  userText: string;
  callTurns: string[];
}) {
  const [ctx, recent, player, intimacyTier] = await Promise.all([
    featuredTalkContext(input.playerId),
    recentPlayerChatTurns(input.playerId),
    findPlayerById(input.playerId),
    resolvePlayerIntimacyTier(input.playerId).catch(() => "EARLY" as const),
  ]);
  const localLine = player ? formatPlayerLocalTimeLine(formatPlayerLocalTime(player.timeZone)) : "";
  const callBlock = input.callTurns.length
    ? `\nTelefoongesprek tot nu:\n${input.callTurns.join("\n")}\n`
    : "";

  const intimate = await resolveIntimateTurn({
    playerId: input.playerId,
    conversationId: input.conversationId,
    userText: input.userText,
    intimacyTier,
  }).catch(() => ({
    useIntimate: false,
    justEntered: false,
    justExited: false,
    sessionStartedAt: null as string | null,
  }));

  const spicy =
    heuristicIntimateIntent(input.userText) || recentChatSuggestsIntimate(recent);
  const useIntimate = intimacyTier === "TRUST" && (intimate.useIntimate || spicy);

  return { ctx, recent, localLine, callBlock, intimacyTier, spicy, useIntimate };
}

async function* streamPhoneReplyText(input: {
  playerId: string;
  conversationId: string;
  userText: string;
  callTurns: string[];
}): AsyncGenerator<string> {
  const prepared = await preparePhoneReply(input);
  const { ctx, recent, localLine, callBlock, intimacyTier, spicy, useIntimate } = prepared;

  if (useIntimate && xaiConfigured()) {
    const context = await buildNyxContext(input.playerId, "INTIMATE_CHAT", input.userText.trim());
    const { core, version } = await loadNyxCore();
    const prompt = `${core}\n\n${version}\nTaak: INTIMATE_CHAT (telefoon)\nContext: ${JSON.stringify(context)}\n\n${localLine ? `${localLine}\n` : ""}Recente chat:\n${recent.join("\n")}${callBlock}\nHardwig (telefoon): ${input.userText}\n\n${NYX_INTIMATE_CHAT_GUIDE}\n\n${NYX_PHONE_CHAT_GUIDE}`;
    try {
      for await (const delta of streamXaiChat({
        model: getXaiModel(),
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: input.userText },
        ],
      })) {
        yield delta;
      }
      return;
    } catch {
      yield PHONE_FALLBACK;
      return;
    }
  }

  if (spicy && intimacyTier !== "TRUST") {
    yield softRedirectBelowTrust();
    return;
  }

  if (openaiConfigured()) {
    const decision = planNyxTask({ task: "CASUAL_CHAT", text: input.userText }).decision;
    const context = await buildNyxContext(input.playerId, "CASUAL_CHAT", input.userText.trim());
    const { core, version } = await loadNyxCore();
    const safeCore = sanitizePersonaCoreForOpenAI(core);
    const safeContext = sanitizeNyxContextForOpenAI(context);
    const taskText = sanitizeOpenAITaskText(
      "CASUAL_CHAT",
      `${input.userText}\n\n${localLine ? `${localLine}\n` : ""}Recente chat:\n${recent.join("\n")}${callBlock}${formatActiveMissionsForPrompt(ctx.activeMissions)}\n\n${NYX_PHONE_CHAT_GUIDE}`,
    );
    const prompt = `${safeCore}\n\n${version}\nTaak: CASUAL_CHAT (telefoon)\nModel: ${decision.model}\nContext: ${JSON.stringify(safeContext)}\n\n${taskText}`;
    try {
      // Phone: no reasoning delay — first audio chunk as soon as a sentence lands.
      for await (const delta of streamOpenAIResponsesText({
        model: decision.model,
        input: prompt,
        reasoningEffort: "none",
      })) {
        yield delta;
      }
      return;
    } catch {
      yield PHONE_FALLBACK;
      return;
    }
  }

  yield PHONE_FALLBACK;
}

async function producePhoneReply(input: {
  playerId: string;
  conversationId: string;
  userText: string;
  callTurns: string[];
}): Promise<{ reply: string; runId: string | null }> {
  const prepared = await preparePhoneReply(input);
  const { ctx, recent, localLine, callBlock, intimacyTier, spicy, useIntimate } = prepared;

  if (useIntimate && xaiConfigured()) {
    const requestId = randomUUID();
    const decision = planNyxTask({ task: "INTIMATE_CHAT", text: input.userText }).decision;
    const context = await buildNyxContext(input.playerId, "INTIMATE_CHAT", input.userText.trim());
    const { core, version } = await loadNyxCore();
    const started = Date.now();
    const prompt = `${core}\n\n${version}\nTaak: INTIMATE_CHAT (telefoon)\nContext: ${JSON.stringify(context)}\n\n${localLine ? `${localLine}\n` : ""}Recente chat:\n${recent.join("\n")}${callBlock}\nHardwig (telefoon): ${input.userText}\n\n${NYX_INTIMATE_CHAT_GUIDE}\n\n${NYX_PHONE_CHAT_GUIDE}`;
    try {
      const result = await callXaiChat({
        model: getXaiModel(),
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: input.userText },
        ],
      });
      const reply = scrubPhoneSpeech(result.text) || PHONE_FALLBACK;
      const runId = await writeNyxRun({
        playerId: input.playerId,
        requestId,
        decision: { ...decision, model: getXaiModel(), reason: `${decision.reason}; phone intimate` },
        latencyMs: Date.now() - started,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        success: true,
        fallbackUsed: false,
        structuredOutputValid: null,
        promptVersion: version,
      }).catch(() => null);
      return { reply, runId };
    } catch {
      return { reply: PHONE_FALLBACK, runId: null };
    }
  }

  if (spicy && intimacyTier !== "TRUST") {
    return { reply: scrubPhoneSpeech(softRedirectBelowTrust()), runId: null };
  }

  if (openaiConfigured()) {
    const live = await Promise.race([
      runNyxTask({
        playerId: input.playerId,
        task: "CASUAL_CHAT",
        text: `${input.userText}\n\n${localLine ? `${localLine}\n` : ""}Recente chat:\n${recent.join("\n")}${callBlock}${formatActiveMissionsForPrompt(ctx.activeMissions)}\n\n${NYX_PHONE_CHAT_GUIDE}`,
        invokeModel: true,
      }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 35_000)),
    ]);
    if (live?.text) {
      return { reply: scrubPhoneSpeech(live.text) || PHONE_FALLBACK, runId: live.runId };
    }
  }

  return { reply: PHONE_FALLBACK, runId: null };
}

async function speakPhoneSentence(text: string): Promise<string> {
  const audio = await synthesizeElevenLabsSpeechStream(text).catch(() => synthesizeElevenLabsSpeech(text));
  return audioToBase64(audio);
}

export async function handleNyxPhoneTurn(input: {
  playerId: string;
  callId: string;
  audioBytes: Uint8Array;
  filename?: string;
  mimeType?: string;
}): Promise<{
  ok: true;
  userText: string;
  nyxText: string;
  audioBase64: string;
  creditLevel: ElevenCreditLevel;
} | { ok: false; error: string; creditEmpty?: boolean }> {
  const call = await getPhoneCall(input.playerId, input.callId);
  if (!call || call.status !== "ACTIVE") {
    return { ok: false, error: "Dit gesprek is niet actief." };
  }

  const credits = await getElevenLabsCreditStatus().catch(() => null);
  if (!credits?.canSpeak) {
    await endPhoneCall(input.playerId, call.id, "QUOTA");
    return { ok: false, error: "Nyx kan je nu niet verstaan — stemtegoed is op.", creditEmpty: true };
  }

  let userText = "";
  try {
    userText = await transcribeAudioWithWhisper({
      bytes: input.audioBytes,
      filename: input.filename,
      mimeType: input.mimeType,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Spraak kon niet worden verstaan.",
    };
  }

  await appendPhoneTurn({
    callId: call.id,
    playerId: input.playerId,
    role: "USER",
    content: userText,
  });

  const turns = await listPhoneTurns(call.id);
  const conversationId = call.conversationId ?? (await listDisplayedNyxConversationIds(input.playerId)).primaryId;
  const produced = await producePhoneReply({
    playerId: input.playerId,
    conversationId,
    userText,
    callTurns: formatPhoneTurnsForPrompt(turns),
  });
  const nyxText = scrubPhoneSpeech(produced.reply) || PHONE_FALLBACK;

  await appendPhoneTurn({
    callId: call.id,
    playerId: input.playerId,
    role: "NYX",
    content: nyxText,
  });

  try {
    const audio = await synthesizeElevenLabsSpeech(nyxText);
    return {
      ok: true,
      userText,
      nyxText,
      audioBase64: audioToBase64(audio),
      creditLevel: credits.level,
    };
  } catch (error) {
    if (error instanceof ElevenLabsQuotaError) {
      await endPhoneCall(input.playerId, call.id, "QUOTA");
      return { ok: false, error: "Stemtegoed is op — gesprek beëindigd.", creditEmpty: true };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Stem kon niet worden gemaakt.",
    };
  }
}

/** Stream STT → LLM tokens → per-sentence ElevenLabs audio (NDJSON to the client). */
export async function* handleNyxPhoneTurnStream(input: {
  playerId: string;
  callId: string;
  audioBytes: Uint8Array;
  filename?: string;
  mimeType?: string;
}): AsyncGenerator<PhoneTurnStreamEvent> {
  const call = await getPhoneCall(input.playerId, input.callId);
  if (!call || call.status !== "ACTIVE") {
    yield { type: "error", error: "Dit gesprek is niet actief." };
    return;
  }

  const credits = await getElevenLabsCreditStatus().catch(() => null);
  if (!credits?.canSpeak) {
    await endPhoneCall(input.playerId, call.id, "QUOTA");
    yield {
      type: "error",
      error: "Nyx kan je nu niet verstaan — stemtegoed is op.",
      creditEmpty: true,
    };
    return;
  }

  let userText = "";
  try {
    userText = await transcribeAudioWithWhisper({
      bytes: input.audioBytes,
      filename: input.filename,
      mimeType: input.mimeType,
    });
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "Spraak kon niet worden verstaan.",
    };
    return;
  }

  yield { type: "user", text: userText };

  await appendPhoneTurn({
    callId: call.id,
    playerId: input.playerId,
    role: "USER",
    content: userText,
  });

  const turns = await listPhoneTurns(call.id);
  const conversationId = call.conversationId ?? (await listDisplayedNyxConversationIds(input.playerId)).primaryId;

  let buffer = "";
  let fullText = "";
  let spokeAny = false;

  try {
    for await (const delta of streamPhoneReplyText({
      playerId: input.playerId,
      conversationId,
      userText,
      callTurns: formatPhoneTurnsForPrompt(turns),
    })) {
      buffer += delta;
      const { sentences, rest } = pullReadySentences(buffer, { final: false });
      buffer = rest;
      for (const sentence of sentences) {
        const clean = scrubPhoneSpeech(sentence);
        if (!clean) continue;
        fullText = fullText ? `${fullText} ${clean}` : clean;
        yield { type: "nyx_partial", text: fullText };
        const audioBase64 = await speakPhoneSentence(clean);
        spokeAny = true;
        yield { type: "audio", text: clean, audioBase64 };
      }
    }

    const { sentences: tail } = pullReadySentences(buffer, { final: true });
    for (const sentence of tail) {
      const clean = scrubPhoneSpeech(sentence);
      if (!clean) continue;
      fullText = fullText ? `${fullText} ${clean}` : clean;
      yield { type: "nyx_partial", text: fullText };
      const audioBase64 = await speakPhoneSentence(clean);
      spokeAny = true;
      yield { type: "audio", text: clean, audioBase64 };
    }
  } catch (error) {
    if (error instanceof ElevenLabsQuotaError) {
      await endPhoneCall(input.playerId, call.id, "QUOTA");
      yield { type: "error", error: "Stemtegoed is op — gesprek beëindigd.", creditEmpty: true };
      return;
    }
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "Stem kon niet worden gemaakt.",
    };
    return;
  }

  const nyxText = scrubPhoneSpeech(fullText) || PHONE_FALLBACK;
  if (!spokeAny) {
    try {
      const audioBase64 = await speakPhoneSentence(nyxText);
      yield { type: "nyx_partial", text: nyxText };
      yield { type: "audio", text: nyxText, audioBase64 };
    } catch (error) {
      if (error instanceof ElevenLabsQuotaError) {
        await endPhoneCall(input.playerId, call.id, "QUOTA");
        yield { type: "error", error: "Stemtegoed is op — gesprek beëindigd.", creditEmpty: true };
        return;
      }
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Stem kon niet worden gemaakt.",
      };
      return;
    }
  }

  await appendPhoneTurn({
    callId: call.id,
    playerId: input.playerId,
    role: "NYX",
    content: nyxText,
  });

  yield { type: "done", nyxText, creditLevel: credits.level };
}

function parsePhoneRecap(raw: string | null | undefined): {
  domain: MemoryDomain;
  category: string;
  normalizedFact: string;
  content: string;
} | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const domain = String(parsed.domain ?? "CONVERSATION_SUMMARY") as MemoryDomain;
    const category = String(parsed.category ?? "CONTEXT");
    const normalizedFact = String(parsed.normalizedFact ?? "").trim();
    const content = String(parsed.content ?? "").trim();
    if (!normalizedFact || !content) return null;
    return { domain, category, normalizedFact, content };
  } catch {
    return null;
  }
}

export async function hangupNyxPhone(playerId: string, callId: string): Promise<{
  ok: boolean;
  summarized: boolean;
}> {
  const call = await getPhoneCall(playerId, callId);
  if (!call) return { ok: false, summarized: false };

  const turns = await listPhoneTurns(callId);
  await endPhoneCall(playerId, callId, call.status === "ACTIVE" ? "ENDED" : call.status);

  const spoken = turns.filter((turn) => turn.content.trim());
  if (spoken.length < 2) {
    return { ok: true, summarized: false };
  }

  const transcript = formatPhoneTurnsForPrompt(spoken).join("\n");
  let recap = openaiConfigured()
    ? parsePhoneRecap(
        (
          await runNyxTask({
            playerId,
            task: "CASUAL_CHAT",
            text: `${NYX_PHONE_RECAP_GUIDE}\n\nTranscript (intern):\n${transcript}`,
            invokeModel: true,
            jsonSchema: {
              type: "object",
              additionalProperties: false,
              required: ["domain", "category", "normalizedFact", "content"],
              properties: {
                domain: {
                  type: "string",
                  enum: ["PERSONAL", "CAMPAIGN", "STRATEGIC", "RELATIONSHIP", "PREFERENCE", "CONVERSATION_SUMMARY"],
                },
                category: { type: "string" },
                normalizedFact: { type: "string" },
                content: { type: "string" },
              },
            },
          }).catch(() => null)
        )?.text,
      )
    : null;

  if (!recap) {
    recap = {
      domain: "CONVERSATION_SUMMARY",
      category: "CONTEXT",
      normalizedFact: "had a phone call with Nyx",
      content: "Hardwig belde met Nyx; ze namen kort iets door in een persoonlijk telefoongesprek.",
    };
  }

  // Soft scrub of explicit dump risk.
  if (/blowjob|neuk|pik|kut|orgasm/i.test(recap.content) || /blowjob|neuk|pik|kut|orgasm/i.test(recap.normalizedFact)) {
    recap = {
      domain: "RELATIONSHIP",
      category: "CONTEXT",
      normalizedFact: "shared a close phone moment with Nyx",
      content: "Hardwig en Nyx deelden een nabij, persoonlijk telefoonmoment; sfeer was warm.",
    };
  }

  await insertMemory(
    playerId,
    {
      domain: recap.domain,
      category: recap.category,
      content: recap.content,
      normalizedFact: recap.normalizedFact.toLowerCase(),
      confidence: "LIKELY",
      importance: "MEDIUM",
      sourceType: "CHAT",
      sourceId: callId,
      userConfirmed: false,
    },
    "AI",
    "Phone call recap.",
  ).catch(() => undefined);

  return { ok: true, summarized: true };
}
