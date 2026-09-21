import { openaiConfigured } from "@/server/ai/client/openai";
import { planNyxTask, runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { handleCasualUserTurn, stripModelNames } from "@/server/ai/fallback/nyxReply";
import { afterNyxReply } from "@/server/ai/services/MemoryExtractionService";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import { recentPlayerChatTurns } from "@/server/domain/nyx/recentChat";
import { buildChatAttachmentContext } from "@/server/ai/services/NyxChatAttachmentContext";
import { tryFulfillChatMediaRequest, userWantsMediaInChat } from "@/server/ai/services/NyxChatMediaService";
import { formatActiveMissionsForPrompt } from "@/server/domain/mission/nyxContext";
import {
  appendMessage,
  featuredTalkContext,
  getOrCreateTalk,
} from "@/server/domain/nyx/talkRepository";
import type { NyxTalkState } from "@/server/domain/nyx/types";

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

export async function sendNyxMessage(playerId: string, input: SendNyxMessageInput | string): Promise<NyxTalkState> {
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

  const ctx = await featuredTalkContext(playerId);
  const recent = await recentPlayerChatTurns(playerId);

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
    return getOrCreateTalk(playerId);
  }

  let reply: string | null = null;
  let runId: string | null = null;
  let fallbackUsed = false;

  const mediaFailNote =
    mediaAttempt.handled && mediaAttempt.action === "FAILED"
      ? `\n\n[Systeem: Hardwig vroeg om beeld maar leveren mislukte (${mediaAttempt.reason}). Antwoord alleen in tekst — geen fictieve foto tussen haken, geen "hier is een foto".]`
      : "";

  const attachmentNote = attachmentContext
    ? `\n\n${attachmentContext}\n\nGeef concrete feedback op wat Hardwig deelde (document, screenshot of website). Verwijs naar specifieke details uit de extractie.`
    : "";

  const live = openaiConfigured()
    ? await runNyxTask({
        playerId,
        task: "CASUAL_CHAT",
        text: `${userContent}\n\nRecente beurten:\n${recent.join("\n")}\n${formatActiveMissionsForPrompt(ctx.activeMissions)}${attachmentNote}${mediaFailNote}`,
        invokeModel: true,
      }).catch(() => null)
    : null;

  if (live?.text) {
    reply = stripModelNames(live.text);
    runId = live.runId;
    fallbackUsed = live.fallbackUsed;
  } else {
    const offline = handleCasualUserTurn(trimmed, {
      featuredTitle: ctx.featuredTitle,
      network: ctx.network,
      economicCurrent: ctx.economicCurrent,
    });
    reply = offline.reply;
    fallbackUsed = true;
  }

  const saved = await appendMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "NYX",
    content: reply,
    runId,
  });

  void fallbackUsed;
  await afterNyxReply({
    playerId,
    userText: trimmed,
    nyxText: reply,
    sourceId: saved.id as string,
    useModel: false,
  }).catch(() => undefined);

  return getOrCreateTalk(playerId);
}
