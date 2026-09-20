import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { NYX_OUTREACH_GUIDE } from "@/server/ai/prompts/outreach";
import { NYX_OUTREACH_JSON_SCHEMA, parseOutreachDecision } from "@/server/ai/schemas/outreach.schema";
import { appendCompanionNyxMessage } from "@/server/domain/nyx/companionRepository";
import { storeNyxGalleryAsset } from "@/server/domain/nyx/galleryRepository";
import { generateNyxStill } from "@/server/domain/nyx/identity/generateStill";
import { hasFaceIdentityRef } from "@/server/domain/nyx/identity/repository";
import { checkNyxIdentityGate } from "@/server/domain/nyx/identity/visionGate";
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
  /** Default 3 for cron outreach; admin test uses 1 to fit Vercel timeouts. */
  maxAttempts?: number;
  faceRefOnly?: boolean;
}): Promise<{ ok: boolean; action: "PHOTO" | "VIDEO" | "SILENCE"; reason: string; mediaId?: string; messageId?: string }> {
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

/** Admin-only: skip outreach gates and run identity-locked still + vision gate. */
async function safeLogOutreachRun(
  input: Parameters<typeof logOutreachRun>[0],
): Promise<void> {
  try {
    await logOutreachRun(input);
  } catch {
    // Admin test / outreach should not fail if run log insert fails.
  }
}

export async function forceNyxTestPhoto(
  playerId: string,
  input?: { scene?: string; caption?: string },
): Promise<{ ok: boolean; action: "PHOTO" | "SILENCE"; reason: string; mediaId?: string; messageId?: string }> {
  let intimacyTier: Awaited<ReturnType<typeof computeIntimacyTier>> = "EARLY";
  try {
    intimacyTier = await computeIntimacyTier(playerId);
  } catch {
    // Test photo only needs a tier label for the run log.
  }
  const scene =
    input?.scene?.trim() ||
    "Portrait, gold latex top, black leather, Kempen dusk light, confident gaze, same Nyx identity.";
  const caption =
    input?.caption?.trim() ||
    "Ik wilde u even iets laten zien — zonder poespas.";

  const delivered = await deliverStillOrVideo({
    playerId,
    scene,
    caption,
    wantVideo: false,
    intimacyTier,
    runId: null,
    maxAttempts: 1,
    faceRefOnly: true,
  });

  await safeLogOutreachRun({
    playerId,
    action: delivered.ok ? delivered.action : "SILENCE",
    reason: delivered.ok ? `Admin test photo: ${delivered.reason}` : delivered.reason,
    intimacyTier,
    mediaId: delivered.mediaId ?? null,
    messageId: delivered.messageId ?? null,
    runId: null,
  });

  if (!delivered.ok || delivered.action === "SILENCE") {
    return { ok: false, action: "SILENCE", reason: delivered.reason };
  }
  return {
    ok: true,
    action: "PHOTO",
    reason: delivered.reason,
    mediaId: delivered.mediaId,
    messageId: delivered.messageId,
  };
}
