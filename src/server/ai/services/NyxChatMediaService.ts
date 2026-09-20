import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { NYX_CHAT_MEDIA_GUIDE } from "@/server/ai/prompts/nyx-chat-media";
import { NYX_OUTREACH_JSON_SCHEMA, parseOutreachDecision } from "@/server/ai/schemas/outreach.schema";
import { fulfillNyxMediaDecision } from "@/server/ai/services/NyxMediaDelivery";
import {
  formatCuratedCatalogForPrompt,
  listCuratedAvailableForOutreach,
} from "@/server/domain/nyx/curated/repository";
import { hasFaceIdentityRef } from "@/server/domain/nyx/identity/repository";
import { computeIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import { openArtVideoEnabled } from "@/server/domain/media/openArtVideo";

const MEDIA_ASK =
  /\b(foto|foto'?s|selfie|beeld|plaatje|pic|picture|video|clip|filmpje)\b|stuur\s+(me\s+|mij\s+|eens\s+)?(een\s+)?(foto|video|beeld|selfie)/i;

export function userWantsMediaInChat(text: string): boolean {
  return MEDIA_ASK.test(text.trim());
}

export type ChatMediaFulfillResult =
  | { handled: false }
  | { handled: true; action: "PHOTO" | "VIDEO" | "TEXT"; messageId?: string }
  | { handled: true; action: "FAILED"; reason: string };

export async function tryFulfillChatMediaRequest(input: {
  playerId: string;
  userText: string;
  conversationId: string;
  recentChat: string[];
  featuredTitle: string;
}): Promise<ChatMediaFulfillResult> {
  if (!userWantsMediaInChat(input.userText)) return { handled: false };

  const intimacyTier = await computeIntimacyTier(input.playerId);
  const [hasRefs, catalog] = await Promise.all([
    hasFaceIdentityRef(),
    listCuratedAvailableForOutreach(input.playerId, intimacyTier),
  ]);

  const prompt = `${NYX_CHAT_MEDIA_GUIDE}

Intimacy tier: ${intimacyTier}
Identity refs beschikbaar: ${hasRefs}
OpenArt video: ${openArtVideoEnabled()}
Hoofdmissie: ${input.featuredTitle}
${formatCuratedCatalogForPrompt(catalog)}

Hardwig vroeg nu:
${input.userText}

Recent chat:
${input.recentChat.join("\n")}`;

  const result = await runNyxTask({
    playerId: input.playerId,
    task: "NYX_OUTREACH",
    text: prompt,
    invokeModel: true,
    jsonSchema: NYX_OUTREACH_JSON_SCHEMA as unknown as Record<string, unknown>,
  }).catch(() => null);

  const decision = parseOutreachDecision(result?.text ?? null);
  if (!decision) return { handled: false };

  const delivered = await fulfillNyxMediaDecision({
    playerId: input.playerId,
    decision,
    intimacyTier,
    runId: result?.runId ?? null,
    conversationId: input.conversationId,
    maxGenerateAttempts: 2,
    faceRefOnly: false,
  });

  if (delivered.ok && delivered.action !== "SILENCE") {
    return {
      handled: true,
      action: delivered.action,
      messageId: delivered.messageId,
    };
  }

  if (decision.action === "PHOTO" || decision.action === "VIDEO") {
    return { handled: true, action: "FAILED", reason: delivered.reason };
  }

  return { handled: false };
}
