import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/server/domain/media/repository";

export type NyxIdentityRefRole = "FACE" | "BODY" | "SIGNATURE_OUTFIT" | "VARIANT_OK";

export type NyxIdentityRef = {
  id: string;
  role: NyxIdentityRefRole;
  storagePath: string;
  label: string | null;
  createdAt: string;
};

const FACE_PROMPT_KEY = "face_prompt";

export async function getCanonicalFacePrompt(): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_identity_settings")
    .select("value")
    .eq("key", FACE_PROMPT_KEY)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return "";
    throw error;
  }
  return (data?.value as string | undefined)?.trim() ?? "";
}

export async function setCanonicalFacePrompt(value: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const trimmed = value.trim();
  const { error } = await admin.from("nyx_identity_settings").upsert(
    {
      key: FACE_PROMPT_KEY,
      value: trimmed,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );
  if (error) throw error;
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
