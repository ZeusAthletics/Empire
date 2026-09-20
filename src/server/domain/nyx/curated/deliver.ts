import { appendCompanionNyxMessage } from "@/server/domain/nyx/companionRepository";
import {
  downloadCuratedBytes,
  getCuratedById,
  hasCuratedDelivery,
  recordCuratedDelivery,
  type NyxCuratedMediaType,
} from "@/server/domain/nyx/curated/repository";
import { intimacyTierAtLeast } from "@/server/domain/nyx/curated/tier";
import { storeNyxGalleryAsset } from "@/server/domain/nyx/galleryRepository";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

export async function deliverCuratedToPlayer(input: {
  playerId: string;
  curatedId: string;
  caption: string;
  playerTier: IntimacyTier;
  expectedType: NyxCuratedMediaType;
  runId: string | null;
}): Promise<{ ok: boolean; reason: string; mediaId?: string; messageId?: string; action: "PHOTO" | "VIDEO" }> {
  const item = await getCuratedById(input.curatedId);
  if (!item) return { ok: false, reason: "Curated id onbekend.", action: input.expectedType };

  if (item.mediaType !== input.expectedType) {
    return {
      ok: false,
      reason: `Curated item is ${item.mediaType}, geen ${input.expectedType}.`,
      action: input.expectedType,
    };
  }
  if (!intimacyTierAtLeast(input.playerTier, item.minIntimacyTier)) {
    return {
      ok: false,
      reason: `Band te laag voor dit item (min ${item.minIntimacyTier}).`,
      action: input.expectedType,
    };
  }
  if (await hasCuratedDelivery(input.playerId, input.curatedId)) {
    return { ok: false, reason: "Curated item al eerder naar deze speler gestuurd.", action: input.expectedType };
  }

  const bytes = await downloadCuratedBytes(item);
  const ext = item.mediaType === "VIDEO" ? "nyx-curated.mp4" : "nyx-curated.jpg";
  const mediaId = await storeNyxGalleryAsset({
    playerId: input.playerId,
    bytes,
    contentType: item.contentType,
    filename: ext,
  });
  const message = await appendCompanionNyxMessage({
    playerId: input.playerId,
    content: input.caption,
    mediaId,
    mediaContext: `Curated ${item.mediaType.toLowerCase()} uit beeldbank: ${item.description}${item.label ? ` (${item.label})` : ""}`,
    runId: input.runId,
  });
  await recordCuratedDelivery({
    curatedId: input.curatedId,
    playerId: input.playerId,
    mediaId,
    messageId: message.id,
  });

  return {
    ok: true,
    reason: `Curated ${item.mediaType} (${item.id.slice(0, 8)}…).`,
    mediaId,
    messageId: message.id,
    action: item.mediaType,
  };
}
