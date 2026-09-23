import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "empire-media";

export type MediaAsset = {
  id: string;
  playerId: string;
  storagePath: string;
  kind: string;
  approved: boolean;
  createdAt: string;
};

function mapAsset(row: Record<string, unknown>): MediaAsset {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    storagePath: row.storage_path as string,
    kind: (row.kind as string) ?? "image",
    approved: Boolean(row.approved),
    createdAt: row.created_at as string,
  };
}

/** App gate URL; GET redirects to a short-lived Supabase signed URL (CDN + byte ranges for video). */
export function publicMediaUrl(id: string) {
  return `/api/media/${id}`;
}

export const MEDIA_SIGNED_URL_TTL_SEC = 60 * 60;

export async function createSignedMediaDownloadUrl(storagePath: string, expiresInSec = MEDIA_SIGNED_URL_TTL_SEC) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, expiresInSec, {
    download: false,
  });
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Signed URL kon niet worden gemaakt.");
  }
  return data.signedUrl;
}

export async function listMedia(playerId: string): Promise<MediaAsset[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("media_assets")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []).map((row) => mapAsset(row as Record<string, unknown>));
}

export async function getMedia(id: string): Promise<MediaAsset | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("media_assets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapAsset(data as Record<string, unknown>) : null;
}

export async function uploadMedia(input: {
  playerId: string;
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
  kind?: string;
}): Promise<MediaAsset> {
  const admin = createSupabaseAdminClient();
  const { data: row, error: insertError } = await admin
    .from("media_assets")
    .insert({
      player_id: input.playerId,
      storage_path: "pending",
      kind: input.kind ?? "JOURNAL",
      approved: false,
    } as never)
    .select("*")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Upload kon niet worden bewaard.");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload.bin";
  const path = `${input.playerId}/${row.id}/${safeName}`;
  const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false,
  });
  if (storageError) {
    await admin.from("media_assets").delete().eq("id", row.id);
    throw new Error("Opslagbucket ontbreekt of weigert het bestand. Maak empire-media aan.");
  }

  const { data: updated, error: updateError } = await admin
    .from("media_assets")
    .update({ storage_path: path } as never)
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError || !updated) throw updateError ?? new Error("Pad kon niet worden gezet.");
  return mapAsset(updated as Record<string, unknown>);
}

export async function setMediaApproved(playerId: string, id: string, approved: boolean) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("media_assets")
    .update({ approved } as never)
    .eq("id", id)
    .eq("player_id", playerId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Beeld kon niet worden bijgewerkt.");
  return mapAsset(data as Record<string, unknown>);
}

export async function downloadMedia(asset: MediaAsset) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).download(asset.storagePath);
  if (error || !data) throw error ?? new Error("Bestand niet gevonden.");
  return data;
}
