import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/server/domain/media/repository";
import {
  DEFAULT_NYX_IMAGE_EDIT_MODEL,
  parseNyxImageEditModel,
  type NyxImageEditModel,
} from "@/server/domain/nyx/identity/imageModel";

export type NyxIdentityRefRole = "FACE" | "BODY" | "SIGNATURE_OUTFIT" | "VARIANT_OK";

export type NyxIdentityRef = {
  id: string;
  role: NyxIdentityRefRole;
  storagePath: string;
  label: string | null;
  createdAt: string;
};

const FACE_PROMPT_KEY = "face_prompt";
const IMAGE_EDIT_MODEL_KEY = "image_edit_model";

function isMissingIdentitySettingsTable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return msg.includes("nyx_identity_settings") && (msg.includes("does not exist") || msg.includes("could not find"));
}

function missingSettingsMigrationError(): Error {
  return new Error("Database-migratie ontbreekt: voer 20260920110000_nyx_identity_face_prompt.sql uit in Supabase.");
}

async function getIdentitySetting(key: string, defaultValue = ""): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("nyx_identity_settings").select("value").eq("key", key).maybeSingle();
  if (error) {
    if (isMissingIdentitySettingsTable(error)) return defaultValue;
    throw error;
  }
  return (data?.value as string | undefined)?.trim() ?? defaultValue;
}

async function setIdentitySetting(key: string, value: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("nyx_identity_settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );
  if (error) {
    if (isMissingIdentitySettingsTable(error)) throw missingSettingsMigrationError();
    throw error;
  }
}

export async function getCanonicalFacePrompt(): Promise<string> {
  return getIdentitySetting(FACE_PROMPT_KEY, "");
}

export async function setCanonicalFacePrompt(value: string): Promise<void> {
  await setIdentitySetting(FACE_PROMPT_KEY, value.trim());
}

export async function getNyxImageEditModel(): Promise<NyxImageEditModel> {
  const raw = await getIdentitySetting(IMAGE_EDIT_MODEL_KEY, DEFAULT_NYX_IMAGE_EDIT_MODEL);
  return parseNyxImageEditModel(raw);
}

export async function setNyxImageEditModel(model: NyxImageEditModel): Promise<void> {
  await setIdentitySetting(IMAGE_EDIT_MODEL_KEY, model);
}

function mapRow(row: Record<string, unknown>): NyxIdentityRef {
  return {
    id: row.id as string,
    role: row.role as NyxIdentityRefRole,
    storagePath: row.storage_path as string,
    label: (row.label as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function listIdentityRefs(): Promise<NyxIdentityRef[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_identity_refs")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function hasFaceIdentityRef(): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("nyx_identity_refs")
    .select("id", { count: "exact", head: true })
    .eq("role", "FACE");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function downloadIdentityRefBytes(ref: NyxIdentityRef): Promise<ArrayBuffer> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).download(ref.storagePath);
  if (error || !data) throw error ?? new Error("Referentie kon niet worden geladen.");
  return data.arrayBuffer();
}

export async function uploadIdentityRef(input: {
  role: NyxIdentityRefRole;
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
  label?: string;
}): Promise<NyxIdentityRef> {
  const admin = createSupabaseAdminClient();
  const { data: row, error: insertError } = await admin
    .from("nyx_identity_refs")
    .insert({
      role: input.role,
      storage_path: "pending",
      label: input.label ?? null,
    } as never)
    .select("*")
    .single();
  if (insertError || !row) throw insertError ?? new Error("Referentie kon niet worden bewaard.");

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "ref.jpg";
  const path = `nyx-identity/${row.id}/${safeName}`;
  const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType || "image/jpeg",
    upsert: false,
  });
  if (storageError) {
    await admin.from("nyx_identity_refs").delete().eq("id", row.id);
    throw new Error("Opslagbucket weigert referentie.");
  }

  const { data: updated, error: updateError } = await admin
    .from("nyx_identity_refs")
    .update({ storage_path: path } as never)
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError || !updated) throw updateError ?? new Error("Referentie pad kon niet worden bijgewerkt.");
  return mapRow(updated as Record<string, unknown>);
}

export async function deleteIdentityRef(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("nyx_identity_refs").select("storage_path").eq("id", id).maybeSingle();
  if (error) throw error;
  if (data?.storage_path) {
    await admin.storage.from(MEDIA_BUCKET).remove([data.storage_path as string]);
  }
  const { error: delError } = await admin.from("nyx_identity_refs").delete().eq("id", id);
  if (delError) throw delError;
}

export async function pickRefsForGeneration(limit = 3): Promise<NyxIdentityRef[]> {
  const all = await listIdentityRefs();
  if (!all.length) return [];
  const order: NyxIdentityRefRole[] = ["FACE", "SIGNATURE_OUTFIT", "BODY", "VARIANT_OK"];
  const picked: NyxIdentityRef[] = [];
  for (const role of order) {
    const match = all.find((ref) => ref.role === role);
    if (match) picked.push(match);
    if (picked.length >= limit) break;
  }
  if (!picked.length) return all.slice(0, limit);
  return picked;
}
