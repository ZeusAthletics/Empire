import { getOpenAIClient, openaiConfigured } from "@/server/ai/client/openai";
import { KEMPEN_VICE_PRESET } from "@/server/ai/prompts/style-preset";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/server/domain/media/repository";
import { publicMediaUrl } from "@/server/domain/media/repository";

const UA = "EmpireMode/1.0 (mission-cover)";

async function fetchPlacePhoto(query: string): Promise<ArrayBuffer | null> {
  const place = query.replace(/,?\s*Belgi[eë].*$/i, "").trim();
  if (place.length < 3) return null;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `${place} Belgium architecture OR street OR kerk -portrait -people`);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "5");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { url?: string; mime?: string }[] }> };
  };
  const pages = Object.values(payload.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.url || !info.mime?.startsWith("image/")) continue;
    if (/svg/i.test(info.mime)) continue;
    const image = await fetch(info.url, { headers: { "User-Agent": UA } });
    if (!image.ok) continue;
    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > 4000) return bytes;
  }
  return null;
}

async function generateCover(subject: string): Promise<ArrayBuffer | null> {
  if (!openaiConfigured()) return null;
  const prompt = `${KEMPEN_VICE_PRESET.promptFragment}\nSubject: ${subject}\nAvoid: ${KEMPEN_VICE_PRESET.negativeFragment}`;
  const result = await getOpenAIClient().images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });
  const b64 = result.data?.[0]?.b64_json;
  if (b64) {
    const buf = Buffer.from(b64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const remote = result.data?.[0]?.url;
  if (!remote) return null;
  const image = await fetch(remote, { headers: { "User-Agent": UA } });
  if (!image.ok) return null;
  return image.arrayBuffer();
}

export async function attachMissionCover(
  playerId: string,
  missionId: string,
  input: { title: string; locationName?: string | null; locationAddress?: string | null; kind?: string | null },
): Promise<string | null> {
  const subject = [input.title, input.locationAddress || input.locationName, input.kind]
    .filter(Boolean)
    .join(" — ");
  let bytes: ArrayBuffer | null = null;
  const place = input.locationAddress || input.locationName;
  if (place) {
    bytes = await fetchPlacePhoto(place).catch(() => null);
  }
  if (!bytes) {
    bytes = await generateCover(subject).catch(() => null);
  }
  if (!bytes) return null;

  const admin = createSupabaseAdminClient();
  const { data: row, error: insertError } = await admin
    .from("media_assets")
    .insert({
      player_id: playerId,
      storage_path: "pending",
      kind: "MISSION_COVER",
      approved: true,
    } as never)
    .select("*")
    .single();
  if (insertError || !row) return null;

  const path = `${playerId}/${row.id}/cover.jpg`;
  const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (storageError) {
    await admin.from("media_assets").delete().eq("id", row.id);
    return null;
  }
  await admin.from("media_assets").update({ storage_path: path } as never).eq("id", row.id);
  await admin.from("missions").update({ media_id: row.id } as never).eq("id", missionId).eq("player_id", playerId);
  return publicMediaUrl(row.id as string);
}

export async function coverMapForMediaIds(ids: string[]): Promise<Map<string, { src: string; approved: boolean }>> {
  const map = new Map<string, { src: string; approved: boolean }>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return map;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("media_assets").select("id, approved").in("id", unique);
  if (error || !data) return map;
  for (const row of data) {
    map.set(row.id as string, { src: publicMediaUrl(row.id as string), approved: Boolean(row.approved) });
  }
  return map;
}
