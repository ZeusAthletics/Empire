import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/server/domain/media/repository";
import { intimacyTierAtLeast } from "@/server/domain/nyx/curated/tier";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

export type NyxCuratedMediaType = "PHOTO" | "VIDEO";

export type NyxCuratedItem = {
  id: string;
  storagePath: string;
  contentType: string;
  mediaType: NyxCuratedMediaType;
  description: string;
  minIntimacyTier: IntimacyTier;
  label: string | null;
  createdAt: string;
  sentToPlayer?: boolean;
};

function mapCurated(row: Record<string, unknown>): NyxCuratedItem {
  return {
    id: row.id as string,
    storagePath: row.storage_path as string,
    contentType: row.content_type as string,
    mediaType: row.media_type as NyxCuratedMediaType,
    description: (row.description as string) ?? "",
    minIntimacyTier: row.min_intimacy_tier as IntimacyTier,
    label: (row.label as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function detectMediaType(contentType: string, filename: string): NyxCuratedMediaType {
  if (contentType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(filename)) return "VIDEO";
  return "PHOTO";
}

export async function listAllCuratedMedia(): Promise<NyxCuratedItem[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("nyx_curated_media").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapCurated(row as Record<string, unknown>));
}

export async function listCuratedForAdmin(playerId: string): Promise<NyxCuratedItem[]> {
  const admin = createSupabaseAdminClient();
  const [items, deliveries] = await Promise.all([
    listAllCuratedMedia(),
    admin.from("nyx_curated_deliveries").select("curated_id").eq("player_id", playerId),
  ]);
  if (deliveries.error) throw deliveries.error;
  const sent = new Set((deliveries.data ?? []).map((row) => row.curated_id as string));
  return items.map((item) => ({ ...item, sentToPlayer: sent.has(item.id) }));
}

export async function listCuratedAvailableForOutreach(
  playerId: string,
  playerTier: IntimacyTier,
): Promise<NyxCuratedItem[]> {
  const admin = createSupabaseAdminClient();
  const { data: delivered, error: delError } = await admin
    .from("nyx_curated_deliveries")
    .select("curated_id")
    .eq("player_id", playerId);
  if (delError) throw delError;
  const sentIds = new Set((delivered ?? []).map((row) => row.curated_id as string));

  const { data, error } = await admin.from("nyx_curated_media").select("*").order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .map((row) => mapCurated(row as Record<string, unknown>))
    .filter((item) => !sentIds.has(item.id) && intimacyTierAtLeast(playerTier, item.minIntimacyTier));
}

export async function getCuratedById(id: string): Promise<NyxCuratedItem | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("nyx_curated_media").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapCurated(data as Record<string, unknown>) : null;
}

export async function hasCuratedDelivery(playerId: string, curatedId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("nyx_curated_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("curated_id", curatedId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function uploadCuratedMedia(input: {
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
  description: string;
  minIntimacyTier: IntimacyTier;
  label?: string;
}): Promise<NyxCuratedItem> {
  const admin = createSupabaseAdminClient();
  const mediaType = detectMediaType(input.contentType, input.filename);
  const { data: row, error: insertError } = await admin
    .from("nyx_curated_media")
    .insert({
      storage_path: "pending",
      content_type: input.contentType || (mediaType === "VIDEO" ? "video/mp4" : "image/jpeg"),
      media_type: mediaType,
      description: input.description.trim(),
      min_intimacy_tier: input.minIntimacyTier,
      label: input.label?.trim() || null,
    } as never)
    .select("*")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Curated item kon niet worden aangemaakt.");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || (mediaType === "VIDEO" ? "clip.mp4" : "still.jpg");
  const path = `nyx-curated/${row.id}/${safeName}`;
  const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (storageError) {
    await admin.from("nyx_curated_media").delete().eq("id", row.id);
    throw new Error("Opslag weigert curated upload.");
  }

  const { data: updated, error: updateError } = await admin
    .from("nyx_curated_media")
    .update({ storage_path: path } as never)
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError || !updated) throw updateError ?? new Error("Curated pad kon niet worden bijgewerkt.");
  return mapCurated(updated as Record<string, unknown>);
}

/** Bypass Vercel 4.5MB body limit — browser uploads directly to Supabase Storage. */
export async function prepareCuratedDirectUpload(input: {
  filename: string;
  contentType: string;
  description: string;
  minIntimacyTier: IntimacyTier;
  label?: string;
}): Promise<{ item: NyxCuratedItem; signedUrl: string }> {
  const admin = createSupabaseAdminClient();
  const mediaType = detectMediaType(input.contentType, input.filename);
  const contentType = input.contentType || (mediaType === "VIDEO" ? "video/mp4" : "image/jpeg");
  const { data: row, error: insertError } = await admin
    .from("nyx_curated_media")
    .insert({
      storage_path: "pending",
      content_type: contentType,
      media_type: mediaType,
      description: input.description.trim(),
      min_intimacy_tier: input.minIntimacyTier,
      label: input.label?.trim() || null,
    } as never)
    .select("*")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Curated item kon niet worden aangemaakt.");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || (mediaType === "VIDEO" ? "clip.mp4" : "still.jpg");
  const path = `nyx-curated/${row.id}/${safeName}`;
  const { data: signed, error: signError } = await admin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (signError || !signed?.signedUrl) {
    await admin.from("nyx_curated_media").delete().eq("id", row.id);
    throw signError ?? new Error("Signed upload URL kon niet worden gemaakt.");
  }

  const { data: updated, error: updateError } = await admin
    .from("nyx_curated_media")
    .update({ storage_path: path } as never)
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError || !updated) {
    await admin.from("nyx_curated_media").delete().eq("id", row.id);
    throw updateError ?? new Error("Curated pad kon niet worden bijgewerkt.");
  }

  return { item: mapCurated(updated as Record<string, unknown>), signedUrl: signed.signedUrl };
}

export async function completeCuratedDirectUpload(id: string): Promise<NyxCuratedItem> {
  const admin = createSupabaseAdminClient();
  const item = await getCuratedById(id);
  if (!item) throw new Error("Curated item niet gevonden.");
  if (item.storagePath === "pending") throw new Error("Upload niet voorbereid.");

  const { error: dlError } = await admin.storage.from(MEDIA_BUCKET).download(item.storagePath);
  if (dlError) {
    await admin.from("nyx_curated_media").delete().eq("id", id);
    throw new Error("Bestand niet in storage — upload opnieuw proberen.");
  }
  return item;
}

export async function updateCuratedMedia(
  id: string,
  patch: { description?: string; minIntimacyTier?: IntimacyTier; label?: string | null },
): Promise<NyxCuratedItem> {
  const admin = createSupabaseAdminClient();
  const body: Record<string, unknown> = {};
  if (patch.description !== undefined) body.description = patch.description.trim();
  if (patch.minIntimacyTier !== undefined) body.min_intimacy_tier = patch.minIntimacyTier;
  if (patch.label !== undefined) body.label = patch.label?.trim() || null;
  const { data, error } = await admin.from("nyx_curated_media").update(body as never).eq("id", id).select("*").single();
  if (error || !data) throw error ?? new Error("Curated item niet gevonden.");
  return mapCurated(data as Record<string, unknown>);
}

export async function deleteCuratedMedia(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("nyx_curated_media").select("storage_path").eq("id", id).maybeSingle();
  if (error) throw error;
  if (data?.storage_path) {
    await admin.storage.from(MEDIA_BUCKET).remove([data.storage_path as string]);
  }
  const { error: delError } = await admin.from("nyx_curated_media").delete().eq("id", id);
  if (delError) throw delError;
}

export async function downloadCuratedBytes(item: NyxCuratedItem): Promise<ArrayBuffer> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).download(item.storagePath);
  if (error || !data) throw error ?? new Error("Curated bestand kon niet worden geladen.");
  return data.arrayBuffer();
}

export async function recordCuratedDelivery(input: {
  curatedId: string;
  playerId: string;
  mediaId: string;
  messageId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("nyx_curated_deliveries").insert({
    curated_id: input.curatedId,
    player_id: input.playerId,
    media_id: input.mediaId,
    message_id: input.messageId,
  } as never);
  if (error) throw error;
}

export function formatCuratedCatalogForPrompt(items: NyxCuratedItem[]): string {
  if (!items.length) {
    return "CATALOGUS: (leeg — geen curated stills/clips beschikbaar voor deze speler/tier; gebruik GENERATE als je beeld wilt sturen.)";
  }
  const lines = items.map(
    (item) =>
      `- id=${item.id} type=${item.mediaType} minTier=${item.minIntimacyTier} — ${item.description || "(geen beschrijving)"}`,
  );
  return `CATALOGUS (elk id max 1× naar deze speler; alleen ids hieronder):\n${lines.join("\n")}`;
}
