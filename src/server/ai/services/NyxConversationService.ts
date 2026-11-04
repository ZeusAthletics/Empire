import { openaiConfigured } from "@/server/ai/client/openai";
import { planNyxTask, runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { handleCasualUserTurn, stripModelNames } from "@/server/ai/fallback/nyxReply";
import { afterNyxReply } from "@/server/ai/services/MemoryExtractionService";
import {
  heuristicIntimateIntent,
  recentChatSuggestsIntimate,
  resolveIntimateTurn,
  runIntimateChat,
  softRedirectBelowTrust,
  writeIntimateRecapMemory,
} from "@/server/ai/services/IntimateModeService";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import { recentPlayerChatTurns } from "@/server/domain/nyx/recentChat";
import { buildChatAttachmentContext } from "@/server/ai/services/NyxChatAttachmentContext";
import { tryFulfillChatMediaRequest, userWantsMediaInChat } from "@/server/ai/services/NyxChatMediaService";
import { formatActiveMissionsForPrompt } from "@/server/domain/mission/nyxContext";
import { resolvePlayerIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import {
  appendMessage,
  featuredTalkContext,
  getOrCreateTalk,
} from "@/server/domain/nyx/talkRepository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NyxTalkState } from "@/server/domain/nyx/types";
import { findPlayerById } from "@/server/domain/player/repository";
import { formatPlayerLocalTime, formatPlayerLocalTimeLine } from "@/server/domain/player/localTime";

export function planCasualChat(text: string, risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "CASUAL_CHAT", text, risk });
}

export async function getNyxTalk(playerId: string): Promise<NyxTalkState> {
  return getOrCreateTalk(playerId);
}

export type SendNyxMessageInput = {
  text?: string;
  mediaId?: string | null;
  linkedUrl?: string | null;
};

export type SendNyxMessageResult = {
  talk: NyxTalkState;
  /** When true, route must not run OpenAI afterNyxReply on this turn. */
  skipMemoryExtraction: boolean;
};

async function latestMessageMeta(conversationId: string): Promise<{
  id: string;
  role: string;
  content: string;
} | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    role: data.role as string,
    content: data.content as string,
  };
}

async function produceNyxReply(input: {
  playerId: string;
  conversationId: string;
  userText: string;
  attachmentNote?: string;
  mediaFailNote?: string;
}): Promise<{
  reply: string;
  runId: string | null;
  skipMemoryExtraction: boolean;
  justExited: boolean;
  sessionStartedAt: string | null;
}> {
  const [ctx, recent, player, intimacyTier] = await Promise.all([
    featuredTalkContext(input.playerId),
    recentPlayerChatTurns(input.playerId),
    findPlayerById(input.playerId),
    resolvePlayerIntimacyTier(input.playerId).catch(() => "EARLY" as const),
  ]);
  const localLine = player ? formatPlayerLocalTimeLine(formatPlayerLocalTime(player.timeZone)) : "";
  const notes = `${input.attachmentNote ?? ""}${input.mediaFailNote ?? ""}`;

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

  // Spicy turns must never hit OpenAI (hangs/refuses). Grok if TRUST, else soft redirect.
  const spicy =
    heuristicIntimateIntent(input.userText) || recentChatSuggestsIntimate(recent);
  const useIntimate =
    intimacyTier === "TRUST" && (intimate.useIntimate || spicy);

  if (useIntimate) {
    const live = await runIntimateChat({
      playerId: input.playerId,
      userText: input.userText,
      recentChat: recent,
      localLine,
      attachmentNote: notes,
    });
    const reply =
      live.text?.trim() ||
      "Ik hoor je — even kort vast. Zeg het nog eens, ik blijf hier.";
    return {
      reply,
      runId: live.runId,
      skipMemoryExtraction: true,
      justExited: intimate.justExited,
      sessionStartedAt: intimate.sessionStartedAt,
    };
  }

  if (spicy) {
    return {
      reply: softRedirectBelowTrust(),
      runId: null,
      skipMemoryExtraction: true,
      justExited: intimate.justExited,
      sessionStartedAt: intimate.sessionStartedAt,
    };
  }

  const live = openaiConfigured()
    ? await Promise.race([
        runNyxTask({
          playerId: input.playerId,
          task: "CASUAL_CHAT",
          text: `${input.userText}\n\n${localLine ? `${localLine}\n` : ""}Recente beurten:\n${recent.join("\n")}\n${formatActiveMissionsForPrompt(ctx.activeMissions)}${notes}`,
          invokeModel: true,
        }).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 40_000)),
      ])
    : null;

  if (live?.text) {
    return {
      reply: stripModelNames(live.text),
      runId: live.runId,
      skipMemoryExtraction: false,
      justExited: intimate.justExited,
      sessionStartedAt: intimate.sessionStartedAt,
    };
  }

  const offline = handleCasualUserTurn(input.userText, {
    featuredTitle: ctx.featuredTitle,
    network: ctx.network,
    economicCurrent: ctx.economicCurrent,
  });
  return {
    reply: offline.reply,
    runId: null,
    skipMemoryExtraction: false,
    justExited: intimate.justExited,
    sessionStartedAt: intimate.sessionStartedAt,
  };
}

/** If the last stored turn is USER without a Nyx reply (failed/hung POST), finish it. */
export async function completeDanglingNyxReply(playerId: string): Promise<SendNyxMessageResult> {
  const talk = await getOrCreateTalk(playerId);
  const last = await latestMessageMeta(talk.conversationId);
  if (!last || last.role !== "USER") {
    return { talk, skipMemoryExtraction: true };
  }

  let produced: Awaited<ReturnType<typeof produceNyxReply>>;
  try {
    produced = await produceNyxReply({
      playerId,
      conversationId: talk.conversationId,
      userText: last.content,
    });
  } catch (error) {
    console.error("[nyx/dangling]", error instanceof Error ? error.message : error);
    produced = {
      reply: "Even vastgelopen — ik ben er nog. Stuur je laatste zin nog eens.",
      runId: null,
      skipMemoryExtraction: true,
      justExited: false,
      sessionStartedAt: null,
    };
  }

  if (!produced.reply?.trim()) {
    produced = { ...produced, reply: "Ik ben er. Zeg het nog eens, dan pak ik de draad op." };
  }

  const stillLast = await latestMessageMeta(talk.conversationId);
  if (!stillLast || stillLast.id !== last.id || stillLast.role !== "USER") {
    return { talk: await getOrCreateTalk(playerId), skipMemoryExtraction: true };
  }

  const saved = await appendMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "NYX",
    content: produced.reply,
    runId: produced.runId,
  });

  if (!produced.skipMemoryExtraction) {
    await afterNyxReply({
      playerId,
      userText: last.content,
      nyxText: produced.reply,
      sourceId: saved.id as string,
      useModel: false,
    }).catch(() => undefined);
  }

  if (produced.justExited) {
    void writeIntimateRecapMemory({
      playerId,
      conversationId: talk.conversationId,
      sessionStartedAt: produced.sessionStartedAt,
      sourceId: saved.id as string,
    }).catch(() => undefined);
  }

  return {
    talk: await getOrCreateTalk(playerId),
    skipMemoryExtraction: produced.skipMemoryExtraction,
  };
}

export async function sendNyxMessage(
  playerId: string,
  input: SendNyxMessageInput | string,
): Promise<SendNyxMessageResult> {
  const payload = typeof input === "string" ? { text: input } : input;
  const trimmed = (payload.text ?? "").trim();
  const mediaId = payload.mediaId?.trim() || null;
  const linkedUrlRaw = payload.linkedUrl?.trim() || null;
  if (!trimmed && !mediaId && !linkedUrlRaw) throw new Error("Zeg Nyx iets, voeg een link toe, of upload een bestand.");

  const talk = await getOrCreateTalk(playerId);

  let attachmentContext = "";
  let linkedUrl: string | null = linkedUrlRaw;
  let userContent = trimmed;

  if (mediaId || linkedUrlRaw) {
    const built = await buildChatAttachmentContext({
      playerId,
      userQuestion: trimmed,
      mediaId,
      linkedUrl: linkedUrlRaw,
    });
    attachmentContext = built.attachmentContext;
    linkedUrl = built.linkedUrl;
    userContent = built.displayText;
  }

  await appendMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "USER",
    content: userContent,
    mediaId,
    linkedUrl,
    attachmentContext: attachmentContext || null,
  });

  const [ctx, recent] = await Promise.all([
    featuredTalkContext(playerId),
    recentPlayerChatTurns(playerId),
  ]);

  const hasUserAttachment = Boolean(mediaId || linkedUrl);
  const mediaAttempt =
    !hasUserAttachment && openaiConfigured() && userWantsMediaInChat(trimmed)
      ? await tryFulfillChatMediaRequest({
          playerId,
          userText: trimmed,
          conversationId: talk.conversationId,
          recentChat: recent,
          featuredTitle: ctx.featuredTitle,
        }).catch(() => ({ handled: false as const }))
      : { handled: false as const };

  if (mediaAttempt.handled && mediaAttempt.action !== "FAILED") {
    return { talk: await getOrCreateTalk(playerId), skipMemoryExtraction: false };
  }

  const mediaFailNote =
    mediaAttempt.handled && mediaAttempt.action === "FAILED"
      ? `\n\n[Systeem: Hardwig vroeg om beeld maar leveren mislukte (${mediaAttempt.reason}). Antwoord alleen in tekst — geen fictieve foto tussen haken, geen "hier is een foto".]`
      : "";

  const attachmentNote = attachmentContext
    ? `\n\n${attachmentContext}\n\nGeef concrete feedback op wat Hardwig deelde (document, screenshot of website). Verwijs naar specifieke details uit de extractie.`
    : "";

  const produced = await produceNyxReply({
    playerId,
    conversationId: talk.conversationId,
    userText: userContent,
    attachmentNote,
    mediaFailNote,
  });

  const saved = await appendMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "NYX",
    content: produced.reply,
    runId: produced.runId,
  });

  if (!produced.skipMemoryExtraction) {
    await afterNyxReply({
      playerId,
      userText: trimmed,
      nyxText: produced.reply,
      sourceId: saved.id as string,
      useModel: false,
    }).catch(() => undefined);
  }

  if (produced.justExited) {
    void writeIntimateRecapMemory({
      playerId,
      conversationId: talk.conversationId,
      sessionStartedAt: produced.sessionStartedAt,
      sourceId: saved.id as string,
    }).catch(() => undefined);
  }

  return {
    talk: await getOrCreateTalk(playerId),
    skipMemoryExtraction: produced.skipMemoryExtraction,
  };
}
