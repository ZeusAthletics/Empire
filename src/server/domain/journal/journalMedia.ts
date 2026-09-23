import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, publicMediaUrl } from "@/server/domain/media/repository";

const JOURNAL_KIND = "JOURNAL";
const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED = [/^image\//];

function allowedType(type: string, name: string): boolean {
  if (ALLOWED.some((re) => re.test(type))) return true;
  return /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name);
}

export async function storeJournalPhoto(input: {
  playerId: string;
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
}): Promise<{ mediaId: string; src: string }> {
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new Error("Afbeelding te groot (max 12 MB).");
  }
  if (!allowedType(input.contentType || "", input.filename)) {
    throw new Error("Alleen afbeeldingen (PNG, JPG, WebP, GIF).");
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error: insertError } = await admin
    .from("media_assets")
    .insert({
      player_id: input.playerId,
      storage_path: "pending",
      kind: JOURNAL_KIND,
      approved: true,
    } as never)
    .select("id")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Foto kon niet worden bewaard.");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "photo.jpg";
  const path = `${input.playerId}/${row.id}/${safeName}`;
  const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType || "image/jpeg",
    upsert: false,
  });
  if (storageError) {
    await admin.from("media_assets").delete().eq("id", row.id);
    throw new Error("Opslag weigerde de foto. Controleer de empire-media bucket.");
  }

  await admin.from("media_assets").update({ storage_path: path } as never).eq("id", row.id);
  const mediaId = row.id as string;
  return { mediaId, src: publicMediaUrl(mediaId) };
}
