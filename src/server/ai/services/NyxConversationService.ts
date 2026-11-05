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
  listDisplayedNyxConversationIds,
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

const DANGLING_FALLBACK =
  "Ik hoorde je — even kort vastgelopen. Ik ben er nog. Zeg het me nog eens, of tik Opnieuw proberen.";

export type DanglingRecoverResult = SendNyxMessageResult & {
  debug: {
    danglingFound: boolean;
    danglingId: string | null;
    appended: boolean;
    replyChars: number;
    reason: string;
    newestRole?: string | null;
  };
};

async function findDanglingUserMessage(playerId: string): Promise<{
  id: string;
  content: string;
  createdAt: string;
  conversationId: string;
  newestRole: string | null;
} | null> {
  const admin = createSupabaseAdminClient();
  // Only the threads the Nyx sheet actually shows — ignore orphan threads that hide dangling USER turns.
  const { conversationIds } = await listDisplayedNyxConversationIds(playerId);
  const { data, error } = await admin
    .from("nyx_messages")
    .select("id, role, content, created_at, conversation_id")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return null;
  const newest = rows[0];
  const newestRole = newest ? String(newest.role) : null;

  // Prefer the newest USER that has no later NYX in the *same* conversation
  // (a check-in on another thread should not hide an unanswered bubble).
  const answeredInConvo = new Set<string>();
  for (const row of rows) {
    const role = String(row.role).toUpperCase();
    const convo = row.conversation_id as string;
    if (role === "NYX") {
      answeredInConvo.add(convo);
      continue;
    }
    if (isUserRole(role) && !answeredInConvo.has(convo)) {
      return {
        id: row.id as string,
        content: row.content as string,
        createdAt: row.created_at as string,
        conversationId: convo,
        newestRole,
      };
    }
  }

  return {
    id: "",
    content: "",
    createdAt: "",
    conversationId: "",
    newestRole,
  };
}

/** Force a reply after a specific USER message id (client recover when threads drifted). */
export async function forceReplyToUserMessage(
  playerId: string,
  userMessageId: string,
): Promise<DanglingRecoverResult> {
  const admin = createSupabaseAdminClient();
  const talk = await getOrCreateTalk(playerId);

  // Trust the sheet timeline: if it already ends on Nyx, nothing to recover.
  const lastVisible = talk.messages[talk.messages.length - 1];
  if (lastVisible?.role === "nyx") {
    return {
      talk,
      skipMemoryExtraction: true,
      debug: {
        danglingFound: false,
        danglingId: null,
        appended: false,
        replyChars: 0,
        reason: "already-answered-in-view",
        newestRole: "NYX",
      },
    };
  }

  // Prefer the newest visible USER bubble over a stale client id (duplicates / older dangling).
  const targetId =
    lastVisible?.role === "me" && lastVisible.id && !lastVisible.id.startsWith("local-")
      ? lastVisible.id
      : userMessageId;

  const { data: row, error } = await admin
    .from("nyx_messages")
    .select("id, role, content, created_at, conversation_id, player_id")
    .eq("id", targetId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  if (!row || !isUserRole(String(row.role))) {
    return {
      talk,
      skipMemoryExtraction: true,
      debug: {
        danglingFound: false,
        danglingId: null,
        appended: false,
        replyChars: 0,
        reason: "force-target-missing",
        newestRole: row ? String(row.role) : null,
      },
    };
  }

  const conversationId = row.conversation_id as string;

  // Skip only when *this exact* turn already has an immediate Nyx reply and there is no
  // later unanswered USER in the same conversation (duplicate resends must still get a reply).
  const { data: afterRows } = await admin
    .from("nyx_messages")
    .select("id, role, content, created_at, conversation_id")
    .eq("conversation_id", conversationId)
    .gt("created_at", row.created_at as string)
    .order("created_at", { ascending: true })
    .limit(20);
  const later = afterRows ?? [];
  let unanswered = row;
  let sawNyxAfterTarget = false;
  for (const item of later) {
    const role = String(item.role).toUpperCase();
    if (role === "NYX") {
      sawNyxAfterTarget = true;
      continue;
    }
    if (isUserRole(role)) {
      // Later user turn — reply to the newest one (reset Nyx-seen for this chain).
      unanswered = item as typeof row;
      sawNyxAfterTarget = false;
    }
  }
  if (sawNyxAfterTarget && unanswered.id === row.id) {
    // Re-check merged talk; a same-thread Nyx after this id should appear last.
    const refreshed = await getOrCreateTalk(playerId);
    const tip = refreshed.messages[refreshed.messages.length - 1];
    if (tip?.role === "nyx") {
      return {
        talk: refreshed,
        skipMemoryExtraction: true,
        debug: {
          danglingFound: true,
          danglingId: row.id as string,
          appended: false,
          replyChars: 0,
          reason: "already-answered-in-view",
          newestRole: "NYX",
        },
      };
    }
    // Talk still ends on USER — ignore the phantom/orphan Nyx row and append.
  }

  const fallback = {
    reply: DANGLING_FALLBACK,
    runId: null as string | null,
    skipMemoryExtraction: true,
    justExited: false,
    sessionStartedAt: null as string | null,
  };

  let produced = fallback;
  try {
    const timed = await Promise.race([
      produceNyxReply({
        playerId,
        conversationId: unanswered.conversation_id as string,
        userText: unanswered.content as string,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)),
    ]);
    produced = timed ?? fallback;
  } catch (err) {
    console.error("[nyx/forceReply]", err instanceof Error ? err.message : err);
    produced = fallback;
  }

  const reply = produced.reply?.trim() || DANGLING_FALLBACK;

  await appendMessage({
    playerId,
    conversationId: unanswered.conversation_id as string,
    role: "NYX",
    content: reply,
    runId: produced.runId,
  });

  let finalTalk = await getOrCreateTalk(playerId);
  let tip = finalTalk.messages[finalTalk.messages.length - 1];
  // If another USER landed during generation (or reply landed off-primary), answer the tip too.
  if (tip?.role === "me" && tip.id && !tip.id.startsWith("local-") && tip.id !== unanswered.id) {
    const { data: tipRow } = await admin
      .from("nyx_messages")
      .select("id, role, content, created_at, conversation_id")
      .eq("id", tip.id)
      .eq("player_id", playerId)
      .maybeSingle();
    if (tipRow && isUserRole(String(tipRow.role))) {
      let tipProduced = fallback;
      try {
        const timed = await Promise.race([
          produceNyxReply({
            playerId,
            conversationId: tipRow.conversation_id as string,
            userText: tipRow.content as string,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)),
        ]);
        tipProduced = timed ?? fallback;
      } catch {
        tipProduced = fallback;
      }
      const tipReply = tipProduced.reply?.trim() || DANGLING_FALLBACK;
      await appendMessage({
        playerId,
        conversationId: tipRow.conversation_id as string,
        role: "NYX",
        content: tipReply,
        runId: tipProduced.runId,
      });
      finalTalk = await getOrCreateTalk(playerId);
      tip = finalTalk.messages[finalTalk.messages.length - 1];
    }
  }

  // Last resort: sheet still ends on USER — pin fallback onto the primary thread.
  if (tip?.role === "me") {
    await appendMessage({
      playerId,
      conversationId: finalTalk.conversationId,
      role: "NYX",
      content: reply,
      runId: produced.runId,
    });
    finalTalk = await getOrCreateTalk(playerId);
    tip = finalTalk.messages[finalTalk.messages.length - 1];
  }

  return {
    talk: finalTalk,
    skipMemoryExtraction: true,
    debug: {
      danglingFound: true,
      danglingId: unanswered.id as string,
      appended: true,
      replyChars: reply.length,
      reason: tip?.role === "nyx" ? (targetId !== userMessageId ? "force-retarget-appended" : "force-appended") : "force-appended-tip-still-user",
      newestRole: tip?.role === "me" ? "USER" : "NYX",
    },
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
export async function completeDanglingNyxReply(playerId: string): Promise<DanglingRecoverResult> {
  const talk = await getOrCreateTalk(playerId);
  const dangling = await findDanglingUserMessage(playerId);
  if (!dangling?.id) {
    return {
      talk,
      skipMemoryExtraction: true,
      debug: {
        danglingFound: false,
        danglingId: null,
        appended: false,
        replyChars: 0,
        reason: "no-dangling-user",
        newestRole: dangling?.newestRole ?? null,
      },
    };
  }

  const replyConversationId = dangling.conversationId || talk.conversationId;

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
        conversationId: replyConversationId,
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

  // Only skip if something newer exists in the *displayed* threads.
  const admin = createSupabaseAdminClient();
  const { conversationIds } = await listDisplayedNyxConversationIds(playerId);
  const { count, error: countError } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
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
        newestRole: dangling.newestRole,
      },
    };
  }

  const saved = await appendMessage({
    playerId,
    conversationId: replyConversationId,
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
      conversationId: replyConversationId,
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
      newestRole: dangling.newestRole,
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

  const fallbackSend = {
    reply: DANGLING_FALLBACK,
    runId: null as string | null,
    skipMemoryExtraction: true,
    justExited: false,
    sessionStartedAt: null as string | null,
  };
  let produced = fallbackSend;
  try {
    const timed = await Promise.race([
      produceNyxReply({
        playerId,
        conversationId: talk.conversationId,
        userText: userContent,
        attachmentNote,
        mediaFailNote,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 55_000)),
    ]);
    produced = timed ?? fallbackSend;
  } catch (error) {
    console.error("[nyx/send]", error instanceof Error ? error.message : error);
    produced = fallbackSend;
  }

  const saved = await appendMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "NYX",
    content: produced.reply?.trim() || DANGLING_FALLBACK,
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
