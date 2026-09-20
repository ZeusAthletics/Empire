import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, publicMediaUrl } from "@/server/domain/media/repository";

export type NyxGalleryItem = {
  id: string;
  src: string;
  kind: string;
  createdAt: string;
  isVideo: boolean;
};

export async function storeNyxGalleryAsset(input: {
  playerId: string;
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: row, error: insertError } = await admin
    .from("media_assets")
    .insert({
      player_id: input.playerId,
      storage_path: "pending",
      kind: "NYX_GALLERY",
      approved: true,
    } as never)
    .select("id")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Galerij-item kon niet worden bewaard.");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "nyx.bin";
  const path = `${input.playerId}/${row.id}/${safeName}`;
  const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (storageError) {
    await admin.from("media_assets").delete().eq("id", row.id);
    throw new Error("Galerij upload mislukt.");
  }
  await admin.from("media_assets").update({ storage_path: path } as never).eq("id", row.id);
  return row.id as string;
}

export async function listNyxGallery(playerId: string): Promise<NyxGalleryItem[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("media_assets")
    .select("id, kind, created_at, storage_path")
    .eq("player_id", playerId)
    .eq("kind", "NYX_GALLERY")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const path = String(row.storage_path ?? "");
    return {
      id: row.id as string,
      src: publicMediaUrl(row.id as string),
      kind: row.kind as string,
      createdAt: row.created_at as string,
      isVideo: /\.mp4$/i.test(path),
    };
  });
}

export async function deleteMediaAsset(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("media_assets").select("storage_path").eq("id", id).maybeSingle();
  if (error) throw error;
  if (data?.storage_path) {
    await admin.storage.from(MEDIA_BUCKET).remove([data.storage_path as string]);
  }
  await admin.from("media_assets").delete().eq("id", id);
}
