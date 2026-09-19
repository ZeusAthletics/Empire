import { openaiConfigured } from "@/server/ai/client/openai";
import { planNyxTask, runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { handleCasualUserTurn, stripModelNames } from "@/server/ai/fallback/nyxReply";
import { afterNyxReply } from "@/server/ai/services/MemoryExtractionService";
import type { IntelligenceRiskProfile } from "@/server/ai/routing/IntelligenceRiskProfile";
import {
  appendMessage,
  featuredTalkContext,
  getOrCreateTalk,
  recentMessageTexts,
} from "@/server/domain/nyx/talkRepository";
import type { NyxTalkState } from "@/server/domain/nyx/types";

export function planCasualChat(text: string, risk?: Partial<IntelligenceRiskProfile>) {
  return planNyxTask({ task: "CASUAL_CHAT", text, risk });
}

export async function getNyxTalk(playerId: string): Promise<NyxTalkState> {
  return getOrCreateTalk(playerId);
}

export async function sendNyxMessage(playerId: string, text: string): Promise<NyxTalkState> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Zeg Nyx eerst iets.");

  const talk = await getOrCreateTalk(playerId);
  await appendMessage({ playerId, conversationId: talk.conversationId, role: "USER", content: trimmed });

  const ctx = await featuredTalkContext(playerId);
  const recent = await recentMessageTexts(talk.conversationId);
  let reply: string | null = null;
  let runId: string | null = null;
  let fallbackUsed = false;

  const live = openaiConfigured()
    ? await runNyxTask({
        playerId,
        task: "CASUAL_CHAT",
        text: `${trimmed}\n\nRecente beurten:\n${recent.join("\n")}\nHoofdmissie: ${ctx.featuredTitle}`,
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
