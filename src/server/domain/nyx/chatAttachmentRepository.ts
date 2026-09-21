import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/server/domain/media/repository";
import { downloadMedia, getMedia, type MediaAsset } from "@/server/domain/media/repository";

const CHAT_KIND = "CHAT_ATTACHMENT";
const MAX_BYTES = 12 * 1024 * 1024;

export async function storeChatAttachment(input: {
  playerId: string;
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
}): Promise<string> {
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error("Bestand te groot (max 12 MB).");
  }
  const admin = createSupabaseAdminClient();
  const { data: row, error: insertError } = await admin
    .from("media_assets")
    .insert({
      player_id: input.playerId,
      storage_path: "pending",
      kind: CHAT_KIND,
      approved: true,
    } as never)
    .select("id")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Bijlage kon niet worden bewaard.");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "chat.bin";
  const path = `${input.playerId}/${row.id}/${safeName}`;
  const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false,
  });
  if (storageError) {
    await admin.from("media_assets").delete().eq("id", row.id);
    throw new Error("Opslag weigerde het bestand.");
  }
  await admin.from("media_assets").update({ storage_path: path } as never).eq("id", row.id);
  return row.id as string;
}

export async function getPlayerChatAttachment(playerId: string, mediaId: string): Promise<MediaAsset | null> {
  const asset = await getMedia(mediaId);
  if (!asset || asset.playerId !== playerId || asset.kind !== CHAT_KIND) return null;
  return asset;
}

export async function downloadChatAttachment(asset: MediaAsset): Promise<{ bytes: ArrayBuffer; blob: Blob }> {
  const blob = await downloadMedia(asset);
  return { bytes: await blob.arrayBuffer(), blob };
}
