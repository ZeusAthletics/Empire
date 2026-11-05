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

function isUserRole(role: string) {
  return role.toUpperCase() === "USER";
}

async function findDanglingUserMessage(conversationId: string): Promise<{
  id: string;
  content: string;
  createdAt: string;
} | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return null;
  // Newest first: if the thread ends on USER, that turn never got a Nyx reply.
  const newest = rows[0];
  if (!newest || !isUserRole(String(newest.role))) return null;
  return {
    id: newest.id as string,
    content: newest.content as string,
    createdAt: newest.created_at as string,
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

export type DanglingRecoverResult = SendNyxMessageResult & {
  debug: {
    danglingFound: boolean;
    danglingId: string | null;
    appended: boolean;
    replyChars: number;
    reason: string;
  };
};

const DANGLING_FALLBACK =
  "Ik hoorde je — even kort vastgelopen. Ik ben er nog. Zeg het me nog eens, of tik Opnieuw proberen.";

/** If the last stored turn is USER without a Nyx reply (failed/hung POST), finish it. */
export async function completeDanglingNyxReply(playerId: string): Promise<DanglingRecoverResult> {
  const talk = await getOrCreateTalk(playerId);
  const dangling = await findDanglingUserMessage(talk.conversationId);
  if (!dangling) {
    return {
      talk,
      skipMemoryExtraction: true,
      debug: {
        danglingFound: false,
        danglingId: null,
        appended: false,
        replyChars: 0,
        reason: "no-dangling-user",
      },
    };
  }

  const fallbackProduced = {
    reply: DANGLING_FALLBACK,
    runId: null as string | null,
    skipMemoryExtraction: true,
    justExited: false,
    sessionStartedAt: null as string | null,
  };

  let produced: Awaited<ReturnType<typeof produceNyxReply>> = fallbackProduced;
  try {
    const timed = await Promise.race([
      produceNyxReply({
        playerId,
        conversationId: talk.conversationId,
        userText: dangling.content,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)),
    ]);
    produced = timed ?? fallbackProduced;
  } catch (error) {
    console.error("[nyx/dangling]", error instanceof Error ? error.message : error);
    produced = fallbackProduced;
  }

  const reply = produced.reply?.trim() || DANGLING_FALLBACK;

  // Only skip if something newer than this USER turn already exists.
  const admin = createSupabaseAdminClient();
  const { count, error: countError } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", talk.conversationId)
    .gt("created_at", dangling.createdAt);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    return {
      talk: await getOrCreateTalk(playerId),
      skipMemoryExtraction: true,
      debug: {
        danglingFound: true,
        danglingId: dangling.id,
        appended: false,
        replyChars: 0,
        reason: "newer-message-exists",
      },
    };
  }

  const saved = await appendMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "NYX",
    content: reply,
    runId: produced.runId,
  });

  if (!produced.skipMemoryExtraction) {
    await afterNyxReply({
      playerId,
      userText: dangling.content,
      nyxText: reply,
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
    debug: {
      danglingFound: true,
      danglingId: dangling.id,
      appended: true,
      replyChars: reply.length,
      reason: "appended",
    },
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
