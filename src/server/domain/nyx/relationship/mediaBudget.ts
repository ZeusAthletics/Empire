import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NyxMediaBudget = {
  maxPhotosPerDay: number;
  maxVideosPerDay: number;
};

export type MediaSentToday = {
  photos: number;
  videos: number;
};

export type MediaBudgetRemaining = {
  photosLeft: number;
  videosLeft: number;
  sent: MediaSentToday;
  budget: NyxMediaBudget;
};

const DEFAULT_BUDGET: NyxMediaBudget = {
  maxPhotosPerDay: 2,
  maxVideosPerDay: 1,
};

function isMissingBudgetTable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return msg.includes("nyx_media_budget") && (msg.includes("does not exist") || msg.includes("could not find"));
}

export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function isVideoStoragePath(path: string): boolean {
  return /\.mp4$/i.test(path);
}

export function classifyMediaDelivery(storagePath: string): "photo" | "video" {
  return isVideoStoragePath(storagePath) ? "video" : "photo";
}

export function remainingFromBudget(budget: NyxMediaBudget, sent: MediaSentToday): MediaBudgetRemaining {
  return {
    budget,
    sent,
    photosLeft: Math.max(0, budget.maxPhotosPerDay - sent.photos),
    videosLeft: Math.max(0, budget.maxVideosPerDay - sent.videos),
  };
}

export async function getMediaBudget(playerId: string): Promise<NyxMediaBudget> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_media_budget")
    .select("max_photos_per_day, max_videos_per_day")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) {
    if (isMissingBudgetTable(error)) return { ...DEFAULT_BUDGET };
    throw error;
  }
  if (!data) return { ...DEFAULT_BUDGET };
  return {
    maxPhotosPerDay: Number(data.max_photos_per_day) ?? DEFAULT_BUDGET.maxPhotosPerDay,
    maxVideosPerDay: Number(data.max_videos_per_day) ?? DEFAULT_BUDGET.maxVideosPerDay,
  };
}

export async function setMediaBudget(playerId: string, budget: Partial<NyxMediaBudget>): Promise<NyxMediaBudget> {
  const current = await getMediaBudget(playerId);
  const next: NyxMediaBudget = {
    maxPhotosPerDay:
      budget.maxPhotosPerDay !== undefined
        ? Math.max(0, Math.floor(budget.maxPhotosPerDay))
        : current.maxPhotosPerDay,
    maxVideosPerDay:
      budget.maxVideosPerDay !== undefined
        ? Math.max(0, Math.floor(budget.maxVideosPerDay))
        : current.maxVideosPerDay,
  };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("nyx_media_budget").upsert(
    {
      player_id: playerId,
      max_photos_per_day: next.maxPhotosPerDay,
      max_videos_per_day: next.maxVideosPerDay,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "player_id" },
  );
  if (error) {
    if (isMissingBudgetTable(error)) {
      throw new Error("Database-migratie ontbreekt: voer 20260921120000_nyx_relationship.sql uit in Supabase.");
    }
    throw error;
  }
  return next;
}

export async function mediaSentToday(playerId: string, now = new Date()): Promise<MediaSentToday> {
  const admin = createSupabaseAdminClient();
  const dayStart = startOfUtcDay(now).toISOString();
  const { data: messages, error } = await admin
    .from("nyx_messages")
    .select("media_id")
    .eq("player_id", playerId)
    .eq("role", "NYX")
    .not("media_id", "is", null)
    .gte("created_at", dayStart);
  if (error) {
    if (error.code === "42703") return { photos: 0, videos: 0 };
    throw error;
  }
  const ids = [...new Set((messages ?? []).map((row) => row.media_id as string).filter(Boolean))];
  if (!ids.length) return { photos: 0, videos: 0 };

  const { data: assets, error: assetError } = await admin.from("media_assets").select("id, storage_path").in("id", ids);
  if (assetError) throw assetError;

  let photos = 0;
  let videos = 0;
  for (const asset of assets ?? []) {
    const path = (asset.storage_path as string) ?? "";
    if (classifyMediaDelivery(path) === "video") videos += 1;
    else photos += 1;
  }
  return { photos, videos };
}

export async function mediaBudgetRemaining(playerId: string, now = new Date()): Promise<MediaBudgetRemaining> {
  const [budget, sent] = await Promise.all([getMediaBudget(playerId), mediaSentToday(playerId, now)]);
  return remainingFromBudget(budget, sent);
}

export function canSendMediaType(
  remaining: MediaBudgetRemaining,
  action: "PHOTO" | "VIDEO",
): boolean {
  if (action === "VIDEO") return remaining.videosLeft > 0;
  return remaining.photosLeft > 0;
}
