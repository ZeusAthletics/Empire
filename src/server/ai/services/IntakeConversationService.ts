import { openaiConfigured } from "@/server/ai/client/openai";
import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { INTAKE_GUIDE, INTAKE_QUESTIONS } from "@/server/ai/prompts/intake";
import { INTAKE_SLOT_SCHEMA, type IntakeSlots } from "@/server/ai/schemas/intake.schema";
import { stripModelNames } from "@/server/ai/fallback/nyxReply";
import {
  appendIntakeMessage,
  getOrCreateIntakeTalk,
} from "@/server/domain/nyx/intakeRepository";
import type { NyxChatMessage } from "@/server/domain/nyx/types";

export type IntakeTalkState = {
  conversationId: string;
  messages: NyxChatMessage[];
  slots: IntakeSlots;
  readyToConfirm: boolean;
  createdMission: null;
};

function emptySlots(): IntakeSlots {
  return { personal: false, business: false, goals: false };
}

function slotsFromUserTurns(count: number): IntakeSlots {
  return {
    personal: count >= 1,
    business: count >= 2,
    goals: count >= 3,
  };
}

function parseSlotPayload(raw: string | null): { slots: IntakeSlots; reply: string } | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      personal?: boolean;
      business?: boolean;
      goals?: boolean;
      reply?: string;
    };
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!reply) return null;
    return {
      slots: {
        personal: Boolean(parsed.personal),
        business: Boolean(parsed.business),
        goals: Boolean(parsed.goals),
      },
      reply,
    };
  } catch {
    return null;
  }
}

function nextScriptedReply(slots: IntakeSlots, userText: string): string {
  if (!slots.personal) {
    return "Genoteerd. Wat bouwt of verkoopt u, en voor wie? Welke afspraken of beperkingen moet ik respecteren?";
  }
  if (!slots.business) {
    return "Duidelijk. Waar wilt u over twaalf maanden staan? Wat is de north star, en wat is de huidige empire-waarde in euro?";
  }
  if (!slots.goals) {
    return `Samenvatting tot hier: ${userText.slice(0, 180)}. Bevestig als dit klopt, of corrigeer wat ik mis.`;
  }
  return "Dit is genoeg om uw profiel te zetten. Bevestig hieronder als het klopt.";
}

export async function getIntakeTalk(playerId: string): Promise<IntakeTalkState> {
  const talk = await getOrCreateIntakeTalk(playerId);
  const userTurns = talk.messages.filter((message) => message.role === "me").length;
  const slots = slotsFromUserTurns(userTurns);
  return {
    conversationId: talk.conversationId,
    messages: talk.messages,
    slots,
    readyToConfirm: slots.personal && slots.business && slots.goals,
    createdMission: null,
  };
}

export async function sendIntakeMessage(playerId: string, text: string): Promise<IntakeTalkState> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Zeg Nyx eerst iets.");

  const talk = await getOrCreateIntakeTalk(playerId);
  await appendIntakeMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "USER",
    content: trimmed,
  });

  const userTurns = talk.messages.filter((message) => message.role === "me").length + 1;
  let slots = slotsFromUserTurns(userTurns);
  let reply: string | null = null;
  let runId: string | null = null;

  const recent = [...talk.messages, { role: "me" as const, text: trimmed, id: "now" }]
    .slice(-12)
    .map((message) => `${message.role === "me" ? "U" : "Nyx"}: ${message.text}`)
    .join("\n");

  const live = openaiConfigured()
    ? await runNyxTask({
        playerId,
        task: "PLAYER_INTAKE",
        text: `${INTAKE_GUIDE}\n\nGesprek:\n${recent}\n\nAntwoord als JSON met personal, business, goals (boolean, true als dat slot in dit gesprek gedekt is) en reply (uw volgende zin).`,
        invokeModel: true,
        jsonSchema: INTAKE_SLOT_SCHEMA as unknown as Record<string, unknown>,
      }).catch(() => null)
    : null;

  const parsed = parseSlotPayload(live?.text ?? null);
  if (parsed) {
    slots = {
      personal: parsed.slots.personal || slots.personal,
      business: parsed.slots.business || slots.business,
      goals: parsed.slots.goals || slots.goals,
    };
    reply = stripModelNames(parsed.reply);
    runId = live?.runId ?? null;
  } else {
    reply = live?.text ? stripModelNames(live.text) : nextScriptedReply(slots, trimmed);
  }

  if (!reply) reply = INTAKE_QUESTIONS[Math.min(userTurns, INTAKE_QUESTIONS.length - 1)] ?? INTAKE_QUESTIONS[0];

  await appendIntakeMessage({
    playerId,
    conversationId: talk.conversationId,
    role: "NYX",
    content: reply,
    runId,
  });

  const refreshed = await getOrCreateIntakeTalk(playerId);
  const ready = slots.personal && slots.business && slots.goals;
  return {
    conversationId: refreshed.conversationId,
    messages: refreshed.messages,
    slots,
    readyToConfirm: ready,
    createdMission: null,
  };
}
