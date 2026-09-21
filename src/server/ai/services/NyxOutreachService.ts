import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { NYX_OUTREACH_GUIDE } from "@/server/ai/prompts/outreach";
import { NYX_OUTREACH_JSON_SCHEMA, parseOutreachDecision } from "@/server/ai/schemas/outreach.schema";
import { deliverStillOrVideo, fulfillNyxMediaDecision } from "@/server/ai/services/NyxMediaDelivery";
import { appendCompanionNyxMessage } from "@/server/domain/nyx/companionRepository";
import { openArtVideoEnabled } from "@/server/domain/media/openArtVideo";
import { collectOutreachHooks, hasOutreachHook } from "@/server/domain/nyx/outreach/hooks";
import { INTIMACY_CATALOG_ACCESS_RULE } from "@/server/domain/nyx/curated/tier";
import { resolvePlayerIntimacyTier, computeIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import { shouldWakeOutreachDecision } from "@/server/domain/nyx/outreach/gate";
import { logOutreachRun } from "@/server/domain/nyx/outreach/repository";
import {
  formatCuratedCatalogForPrompt,
  listCuratedAvailableForOutreach,
} from "@/server/domain/nyx/curated/repository";
import { hasFaceIdentityRef } from "@/server/domain/nyx/identity/repository";
import { canSendMediaType, mediaBudgetRemaining } from "@/server/domain/nyx/relationship/mediaBudget";

export async function runNyxOutreachTick(playerId: string) {
  const intimacyTier = await resolvePlayerIntimacyTier(playerId);
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
  const catalog = await listCuratedAvailableForOutreach(playerId, intimacyTier);
  const budget = await mediaBudgetRemaining(playerId).catch(() => null);
  const budgetLine = budget
    ? `Dagbudget media (max, niet verplicht): foto's ${budget.sent.photos}/${budget.budget.maxPhotosPerDay} (nog ${budget.photosLeft}), video's ${budget.sent.videos}/${budget.budget.maxVideosPerDay} (nog ${budget.videosLeft}).`
    : "";
  const prompt = `${NYX_OUTREACH_GUIDE}\n\n${INTIMACY_CATALOG_ACCESS_RULE}\n\nIntimacy tier: ${intimacyTier}\nIdentity refs beschikbaar: ${hasRefs}\nOpenArt video: ${openArtVideoEnabled()}\n${budgetLine}\n${formatCuratedCatalogForPrompt(catalog, intimacyTier)}\nHooks:\n${hookContext.hooks.join("\n")}\n\nRecent chat:\n${hookContext.recentChat.join("\n")}`;

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

  if (
    budget &&
    (decision.action === "PHOTO" || decision.action === "VIDEO") &&
    !canSendMediaType(budget, decision.action)
  ) {
    await logOutreachRun({
      playerId,
      action: "SILENCE",
      reason: "Dagbudget media bereikt.",
      intimacyTier,
      runId: result.runId,
    });
    return { action: "SILENCE" as const };
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

  const delivered = await fulfillNyxMediaDecision({
    playerId,
    decision,
    intimacyTier,
    runId: result.runId,
  });

  if (!delivered.ok || delivered.action === "SILENCE" || delivered.action === "TEXT") {
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
