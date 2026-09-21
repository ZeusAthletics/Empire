import { isValidTimeZone, normalizePlayerTimeZone } from "@/server/domain/player/localTime";
import { updatePlayerTimeZone } from "@/server/domain/player/repository";

export async function syncPlayerTimeZoneFromHeader(
  playerId: string,
  headerValue: string | null | undefined,
): Promise<void> {
  const trimmed = headerValue?.trim();
  if (!trimmed || !isValidTimeZone(trimmed)) return;
  const normalized = normalizePlayerTimeZone(trimmed);
  await updatePlayerTimeZone(playerId, normalized);
}
