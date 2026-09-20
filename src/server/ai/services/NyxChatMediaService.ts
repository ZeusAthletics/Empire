import { openaiConfigured } from "@/server/ai/client/openai";
import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { NYX_CHAT_MEDIA_GUIDE } from "@/server/ai/prompts/nyx-chat-media";
import {
  NYX_OUTREACH_JSON_SCHEMA,
  normalizeOutreachDecision,
  parseOutreachDecision,
  type NyxOutreachDecision,
} from "@/server/ai/schemas/outreach.schema";
import { deliverStillOrVideo, fulfillNyxMediaDecision } from "@/server/ai/services/NyxMediaDelivery";
import { deliverCuratedToPlayer } from "@/server/domain/nyx/curated/deliver";
import {
  chatGenerateScene,
  chatMediaCaption,
  pickCuratedForChat,
} from "@/server/domain/nyx/curated/pickForChat";
import {
  formatCuratedCatalogForPrompt,
  listCuratedAvailableForOutreach,
  type NyxCuratedItem,
} from "@/server/domain/nyx/curated/repository";
import { hasFaceIdentityRef } from "@/server/domain/nyx/identity/repository";
import { computeIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import { openArtVideoEnabled } from "@/server/domain/media/openArtVideo";

const MEDIA_ASK =
  /\b(foto|foto'?s|selfie|beeld|plaatje|pic|picture|video|clip|filmpje)\b|stuur\s+(me\s+|mij\s+|eens\s+)?(een\s+)?(foto|video|beeld|selfie)/i;

export function userWantsMediaInChat(text: string): boolean {
  return MEDIA_ASK.test(text.trim());
}

function userWantsVideo(text: string): boolean {
  return /\b(video|filmpje|clip)\b/i.test(text);
}

export type ChatMediaFulfillResult =
  | { handled: false }
  | { handled: true; action: "PHOTO" | "VIDEO" | "TEXT"; messageId?: string }
  | { handled: true; action: "FAILED"; reason: string };

function alignDecisionWithCatalog(
  decision: NyxOutreachDecision,
  catalog: NyxCuratedItem[],
  userText: string,
  wantVideo: boolean,
): NyxOutreachDecision {
  const next = { ...decision };
  const id = next.curatedMediaId?.trim();
  const inCatalog = id ? catalog.some((item) => item.id === id) : false;

  if (next.action === "SILENCE" || next.action === "TEXT") {
    if (catalog.length || (next.action === "SILENCE" && userWantsMediaInChat(userText))) {
      next.action = wantVideo ? "VIDEO" : "PHOTO";
    }
  }

  if (next.action === "PHOTO" || next.action === "VIDEO") {
    if (!inCatalog) {
      const pick = pickCuratedForChat(catalog, userText, wantVideo);
      if (pick) {
        next.mediaSource = "CURATED";
        next.curatedMediaId = pick.id;
      } else if (!next.mediaSource || next.mediaSource === "CURATED") {
        next.mediaSource = "GENERATE";
        next.curatedMediaId = undefined;
      }
    } else {
      next.mediaSource = "CURATED";
    }
    if (!next.caption?.trim()) next.caption = chatMediaCaption(userText);
    if (!next.scene?.trim()) next.scene = chatGenerateScene(userText, "");
  }

  return normalizeOutreachDecision(next);
}

async function deliverCatalogFallback(input: {
  playerId: string;
  conversationId: string;
  catalog: NyxCuratedItem[];
  userText: string;
  featuredTitle: string;
  intimacyTier: Awaited<ReturnType<typeof computeIntimacyTier>>;
  wantVideo: boolean;
  runId: string | null;
}): Promise<ChatMediaFulfillResult | null> {
  const pick = pickCuratedForChat(input.catalog, input.userText, input.wantVideo);
  if (!pick) return null;

  const delivered = await deliverCuratedToPlayer({
    playerId: input.playerId,
    curatedId: pick.id,
    caption: chatMediaCaption(input.userText),
    playerTier: input.intimacyTier,
    expectedType: pick.mediaType,
    runId: input.runId,
    conversationId: input.conversationId,
  });
  if (!delivered.ok) return null;
  return {
    handled: true,
    action: delivered.action,
    messageId: delivered.messageId,
  };
}

async function deliverGenerateFallback(input: {
  playerId: string;
  conversationId: string;
  userText: string;
  featuredTitle: string;
  wantVideo: boolean;
  runId: string | null;
}): Promise<ChatMediaFulfillResult | null> {
  const hasRefs = await hasFaceIdentityRef();
  if (!hasRefs) return null;

  const delivered = await deliverStillOrVideo({
    playerId: input.playerId,
    scene: chatGenerateScene(input.userText, input.featuredTitle),
    caption: chatMediaCaption(input.userText),
    wantVideo: input.wantVideo,
    runId: input.runId,
    conversationId: input.conversationId,
    maxAttempts: 1,
    faceRefOnly: true,
  });
  if (!delivered.ok || delivered.action === "SILENCE" || delivered.action === "TEXT") return null;
  return {
    handled: true,
    action: delivered.action,
    messageId: delivered.messageId,
  };
}

export async function tryFulfillChatMediaRequest(input: {
  playerId: string;
  userText: string;
  conversationId: string;
  recentChat: string[];
  featuredTitle: string;
}): Promise<ChatMediaFulfillResult> {
  if (!userWantsMediaInChat(input.userText)) return { handled: false };

  const wantVideo = userWantsVideo(input.userText);
  const intimacyTier = await computeIntimacyTier(input.playerId);
  const [hasRefs, catalog] = await Promise.all([
    hasFaceIdentityRef(),
    listCuratedAvailableForOutreach(input.playerId, intimacyTier),
  ]);

  let runId: string | null = null;
  let decision: NyxOutreachDecision | null = null;

  if (openaiConfigured()) {
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

    runId = result?.runId ?? null;
    decision = parseOutreachDecision(result?.text ?? null);
    if (decision) {
      decision = alignDecisionWithCatalog(decision, catalog, input.userText, wantVideo);
      if (!decision.scene?.trim()) decision.scene = chatGenerateScene(input.userText, input.featuredTitle);
    }
  }

  if (decision && (decision.action === "PHOTO" || decision.action === "VIDEO")) {
    const delivered = await fulfillNyxMediaDecision({
      playerId: input.playerId,
      decision,
      intimacyTier,
      runId,
      conversationId: input.conversationId,
      maxGenerateAttempts: 1,
      faceRefOnly: true,
    });

    if (delivered.ok && (delivered.action === "PHOTO" || delivered.action === "VIDEO")) {
      return {
        handled: true,
        action: delivered.action,
        messageId: delivered.messageId,
      };
    }
  }

  const fromCatalog = await deliverCatalogFallback({
    playerId: input.playerId,
    conversationId: input.conversationId,
    catalog,
    userText: input.userText,
    featuredTitle: input.featuredTitle,
    intimacyTier,
    wantVideo,
    runId,
  });
  if (fromCatalog) return fromCatalog;

  const fromGenerate = await deliverGenerateFallback({
    playerId: input.playerId,
    conversationId: input.conversationId,
    userText: input.userText,
    featuredTitle: input.featuredTitle,
    wantVideo,
    runId,
  });
  if (fromGenerate) return fromGenerate;

  const reason =
    !catalog.length && !hasRefs
      ? "Geen galerij-items voor uw band en geen identity refs om te genereren."
      : !catalog.length
        ? "Genereren mislukte (identity gate of model)."
        : "Galerij-item kon niet worden geleverd.";

  return { handled: true, action: "FAILED", reason };
}
