import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { NYX_OUTREACH_GUIDE } from "@/server/ai/prompts/outreach";
import { NYX_OUTREACH_JSON_SCHEMA, parseOutreachDecision } from "@/server/ai/schemas/outreach.schema";
import { appendCompanionNyxMessage } from "@/server/domain/nyx/companionRepository";
import { storeNyxGalleryAsset } from "@/server/domain/nyx/galleryRepository";
import { generateNyxStill } from "@/server/domain/nyx/identity/generateStill";
import { hasFaceIdentityRef } from "@/server/domain/nyx/identity/repository";
import { passesNyxIdentityGate } from "@/server/domain/nyx/identity/visionGate";
import { imageToVideoFromStill, openArtVideoEnabled } from "@/server/domain/media/openArtVideo";
import { collectOutreachHooks, hasOutreachHook } from "@/server/domain/nyx/outreach/hooks";
import { computeIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import { shouldWakeOutreachDecision } from "@/server/domain/nyx/outreach/gate";
import { logOutreachRun } from "@/server/domain/nyx/outreach/repository";

async function deliverStillOrVideo(input: {
  playerId: string;
  scene: string;
  caption: string;
  wantVideo: boolean;
  intimacyTier: Awaited<ReturnType<typeof computeIntimacyTier>>;
  runId: string | null;
}): Promise<{ ok: boolean; action: "PHOTO" | "VIDEO" | "SILENCE"; reason: string; mediaId?: string; messageId?: string }> {
  const hasRefs = await hasFaceIdentityRef();
  if (!hasRefs) {
    return { ok: false, action: "SILENCE", reason: "Geen identity refs — geen autonome foto." };
  }

  let still = await generateNyxStill(input.scene);
  if (!still) {
    return { ok: false, action: "SILENCE", reason: "Still generatie mislukt." };
  }

  let passed = await passesNyxIdentityGate(still);
  if (!passed) {
    still = await generateNyxStill(input.scene);
    if (!still) {
      return { ok: false, action: "SILENCE", reason: "Identity gate: retry mislukt." };
    }
    passed = await passesNyxIdentityGate(still);
    if (!passed) {
      return { ok: false, action: "SILENCE", reason: "Identity gate: geen match met Nyx." };
    }
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
      const message = await appendCompanionNyxMessage({
        playerId: input.playerId,
        content: input.caption,
        mediaId,
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
  const message = await appendCompanionNyxMessage({
    playerId: input.playerId,
    content: input.caption,
    mediaId,
    runId: input.runId,
  });
  return { ok: true, action: "PHOTO", reason: "Foto na identity gate.", mediaId, messageId: message.id };
}

export async function runNyxOutreachTick(playerId: string) {
  const intimacyTier = await computeIntimacyTier(playerId);
  const wake = await shouldWakeOutreachDecision(playerId, intimacyTier);
  if (!wake) {
    await logOutreachRun({
      playerId,
      action: "SILENCE",
      reason: "Tick: probabiliteit / cooldown — geen beslissing.",
      intimacyTier,
    });
    return { action: "SILENCE" as const, skipped: true };
  }

  const hookContext = await collectOutreachHooks(playerId);
  if (!hasOutreachHook(hookContext)) {
    await logOutreachRun({
      playerId,
      action: "SILENCE",
      reason: "Geen hook voor outreach.",
      intimacyTier,
    });
    return { action: "SILENCE" as const, skipped: true };
  }

  const hasRefs = await hasFaceIdentityRef();
  const prompt = `${NYX_OUTREACH_GUIDE}\n\nIntimacy tier: ${intimacyTier}\nIdentity refs beschikbaar: ${hasRefs}\nOpenArt video: ${openArtVideoEnabled()}\nHooks:\n${hookContext.hooks.join("\n")}\n\nRecent chat:\n${hookContext.recentChat.join("\n")}`;

  const result = await runNyxTask({
    playerId,
    task: "NYX_OUTREACH",
    text: prompt,
    invokeModel: true,
    jsonSchema: NYX_OUTREACH_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  const decision = parseOutreachDecision(result.text);
  if (!decision) {
    await logOutreachRun({
      playerId,
      action: "SILENCE",
      reason: "Model antwoord ongeldig.",
      intimacyTier,
      runId: result.runId,
    });
    return { action: "SILENCE" as const, skipped: true };
  }

  if (decision.action === "SILENCE") {
    await logOutreachRun({
      playerId,
      action: "SILENCE",
      reason: decision.reason,
      intimacyTier,
      runId: result.runId,
    });
    return { action: "SILENCE" as const };
  }

  if (decision.action === "TEXT") {
    const caption = decision.caption?.trim() || decision.reason;
    const message = await appendCompanionNyxMessage({
      playerId,
      content: caption,
      runId: result.runId,
    });
    await logOutreachRun({
      playerId,
      action: "TEXT",
      reason: decision.reason,
      intimacyTier,
      messageId: message.id,
      runId: result.runId,
    });
    return { action: "TEXT" as const };
  }

  const caption = decision.caption?.trim() || "…";
  const scene = decision.scene?.trim() || decision.reason;
  const wantVideo = decision.action === "VIDEO";

  const delivered = await deliverStillOrVideo({
    playerId,
    scene,
    caption,
    wantVideo,
    intimacyTier,
    runId: result.runId,
  });

  if (!delivered.ok) {
    if (wantVideo && hasRefs) {
      const fallback = await deliverStillOrVideo({
        playerId,
        scene,
        caption,
        wantVideo: false,
        intimacyTier,
        runId: result.runId,
      });
      if (fallback.ok) {
        await logOutreachRun({
          playerId,
          action: fallback.action,
          reason: `${decision.reason} · fallback foto`,
          intimacyTier,
          mediaId: fallback.mediaId,
          messageId: fallback.messageId,
          runId: result.runId,
        });
        return { action: fallback.action };
      }
    }
    await logOutreachRun({
      playerId,
      action: "SILENCE",
      reason: delivered.reason,
      intimacyTier,
      runId: result.runId,
    });
    return { action: "SILENCE" as const };
  }

  await logOutreachRun({
    playerId,
    action: delivered.action,
    reason: decision.reason,
    intimacyTier,
    mediaId: delivered.mediaId,
    messageId: delivered.messageId,
    runId: result.runId,
  });
  return { action: delivered.action };
}
