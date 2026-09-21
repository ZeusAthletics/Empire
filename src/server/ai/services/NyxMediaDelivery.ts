import type { NyxOutreachDecision } from "@/server/ai/schemas/outreach.schema";
import { appendCompanionNyxMessage } from "@/server/domain/nyx/companionRepository";
import { deliverCuratedToPlayer } from "@/server/domain/nyx/curated/deliver";
import { storeNyxGalleryAsset } from "@/server/domain/nyx/galleryRepository";
import { generateNyxStill } from "@/server/domain/nyx/identity/generateStill";
import { hasFaceIdentityRef } from "@/server/domain/nyx/identity/repository";
import { checkNyxIdentityGate } from "@/server/domain/nyx/identity/visionGate";
import { imageToVideoFromStill, openArtVideoEnabled } from "@/server/domain/media/openArtVideo";
import { generateSceneForTier } from "@/server/domain/nyx/curated/pickForChat";
import { isCuratedIntimacyBlockedReason } from "@/server/domain/nyx/curated/tier";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import { appendOutboundNyxMessage } from "@/server/domain/nyx/talkRepository";

export type NyxMediaDeliveryResult = {
  ok: boolean;
  action: "PHOTO" | "VIDEO" | "TEXT" | "SILENCE";
  reason: string;
  mediaId?: string;
  messageId?: string;
};

async function saveOutboundMessage(input: {
  playerId: string;
  conversationId?: string;
  content: string;
  mediaId?: string;
  mediaContext?: string;
  runId: string | null;
}): Promise<{ id: string }> {
  if (input.conversationId) {
    return appendOutboundNyxMessage({
      playerId: input.playerId,
      conversationId: input.conversationId,
      content: input.content,
      mediaId: input.mediaId ?? null,
      mediaContext: input.mediaContext ?? null,
      runId: input.runId,
    });
  }
  return appendCompanionNyxMessage({
    playerId: input.playerId,
    content: input.content,
    mediaId: input.mediaId ?? null,
    mediaContext: input.mediaContext ?? null,
    runId: input.runId,
  });
}

export async function deliverStillOrVideo(input: {
  playerId: string;
  scene: string;
  caption: string;
  wantVideo: boolean;
  runId: string | null;
  conversationId?: string;
  maxAttempts?: number;
  faceRefOnly?: boolean;
}): Promise<NyxMediaDeliveryResult> {
  const hasRefs = await hasFaceIdentityRef();
  if (!hasRefs) {
    return { ok: false, action: "SILENCE", reason: "Geen identity refs — geen autonome foto." };
  }

  let still: ArrayBuffer | null = null;
  let lastGateReason = "Identity gate: geen match met Nyx.";
  let lastGenError = "Still generatie mislukt.";
  const maxAttempts = input.maxAttempts ?? 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const generated = await generateNyxStill(input.scene, { faceRefOnly: input.faceRefOnly });
    if (!generated.bytes) {
      lastGenError = generated.error ?? lastGenError;
      continue;
    }
    still = generated.bytes;
    const gate = await checkNyxIdentityGate(still);
    if (gate.pass) break;
    lastGateReason = `Identity gate: ${gate.reason} (${Math.round(gate.confidence * 100)}%)`;
    still = null;
  }
  if (!still) {
    const reason = lastGenError !== "Still generatie mislukt." ? lastGenError : lastGateReason;
    return { ok: false, action: "SILENCE", reason };
  }

  if (input.wantVideo && openArtVideoEnabled()) {
    const mp4 = await imageToVideoFromStill(still, input.scene);
    if (mp4) {
      const mediaId = await storeNyxGalleryAsset({
        playerId: input.playerId,
        bytes: mp4,
        contentType: "video/mp4",
        filename: "nyx-outreach.mp4",
      });
      const message = await saveOutboundMessage({
        playerId: input.playerId,
        conversationId: input.conversationId,
        content: input.caption,
        mediaId,
        mediaContext: `Gegenereerde video (identity lock), scene: ${input.scene}`,
        runId: input.runId,
      });
      return { ok: true, action: "VIDEO", reason: "Video via locked still.", mediaId, messageId: message.id };
    }
  }

  const mediaId = await storeNyxGalleryAsset({
    playerId: input.playerId,
    bytes: still,
    contentType: "image/jpeg",
    filename: "nyx-outreach.jpg",
  });
  const message = await saveOutboundMessage({
    playerId: input.playerId,
    conversationId: input.conversationId,
    content: input.caption,
    mediaId,
    mediaContext: `Gegenereerde foto (identity lock), scene: ${input.scene}`,
    runId: input.runId,
  });
  return { ok: true, action: "PHOTO", reason: "Foto na identity gate.", mediaId, messageId: message.id };
}

export async function fulfillNyxMediaDecision(input: {
  playerId: string;
  decision: NyxOutreachDecision;
  intimacyTier: IntimacyTier;
  runId: string | null;
  conversationId?: string;
  maxGenerateAttempts?: number;
  faceRefOnly?: boolean;
}): Promise<NyxMediaDeliveryResult> {
  const { decision, playerId, intimacyTier, runId, conversationId } = input;

  if (decision.action === "SILENCE") {
    return { ok: false, action: "SILENCE", reason: decision.reason };
  }

  if (decision.action === "TEXT") {
    const caption = decision.caption?.trim() || decision.reason;
    const message = await saveOutboundMessage({
      playerId,
      conversationId,
      content: caption,
      runId,
    });
    return { ok: true, action: "TEXT", reason: decision.reason, messageId: message.id };
  }

  const caption = decision.caption?.trim() || "…";
  const wantVideo = decision.action === "VIDEO";
  const scene = generateSceneForTier({
    tier: intimacyTier,
    userText: decision.reason,
    featuredTitle: "",
    proposedScene: decision.scene?.trim() || decision.reason,
  });
  const expectedType = wantVideo ? "VIDEO" : "PHOTO";
  const hasRefs = await hasFaceIdentityRef();

  let delivered: NyxMediaDeliveryResult;

  if (decision.mediaSource === "CURATED" && decision.curatedMediaId?.trim()) {
    const curated = await deliverCuratedToPlayer({
      playerId,
      curatedId: decision.curatedMediaId.trim(),
      caption,
      playerTier: intimacyTier,
      expectedType,
      runId,
      conversationId,
    });
    if (curated.ok) {
      delivered = {
        ok: true,
        action: curated.action,
        reason: curated.reason,
        mediaId: curated.mediaId,
        messageId: curated.messageId,
      };
    } else if (hasRefs && !isCuratedIntimacyBlockedReason(curated.reason)) {
      delivered = await deliverStillOrVideo({
        playerId,
        scene,
        caption,
        wantVideo,
        runId,
        conversationId,
        maxAttempts: input.maxGenerateAttempts,
        faceRefOnly: input.faceRefOnly,
      });
      if (delivered.ok) {
        delivered.reason = `${curated.reason} · fallback GENERATE: ${delivered.reason}`;
      }
    } else {
      delivered = { ok: false, action: "SILENCE", reason: curated.reason };
    }
  } else {
    delivered = await deliverStillOrVideo({
      playerId,
      scene,
      caption,
      wantVideo,
      runId,
      conversationId,
      maxAttempts: input.maxGenerateAttempts,
      faceRefOnly: input.faceRefOnly,
    });
  }

  if (!delivered.ok && wantVideo && hasRefs) {
    const fallback = await deliverStillOrVideo({
      playerId,
      scene,
      caption,
      wantVideo: false,
      runId,
      conversationId,
      maxAttempts: input.maxGenerateAttempts,
      faceRefOnly: input.faceRefOnly,
    });
    if (fallback.ok) {
      return { ...fallback, reason: `${decision.reason} · fallback foto` };
    }
  }

  return delivered;
}
