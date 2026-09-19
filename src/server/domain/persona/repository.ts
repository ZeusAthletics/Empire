import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { compilePersona, DEFAULT_PERSONA } from "@/server/ai/prompts/persona";

export type StoredPersona = {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  name: string;
  address: string;
  compiledPrompt: string;
  compiledAt: string;
};

function mapPersona(row: Record<string, unknown>): StoredPersona {
  return {
    id: row.id as string,
    version: Number(row.version ?? 1),
    status: (row.status as StoredPersona["status"]) ?? "DRAFT",
    name: (row.name as string) ?? "Nyx",
    address: (row.address as string) ?? "u",
    compiledPrompt: (row.compiled_prompt as string) ?? "",
    compiledAt: row.compiled_at as string,
  };
}

export async function getActivePersona(): Promise<StoredPersona | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("personas").select("*").eq("status", "ACTIVE").maybeSingle();
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) return null;
    throw error;
  }
  return data ? mapPersona(data as Record<string, unknown>) : null;
}

export async function saveActivePersona(input: { compiledPrompt: string; address?: string; name?: string }) {
  const compiledPrompt = input.compiledPrompt.trim();
  if (compiledPrompt.length < 40) {
    throw new Error("De persoonlijkheid is te kort. Beschrijf wie Nyx is.");
  }

  const admin = createSupabaseAdminClient();
  const current = await getActivePersona();
  const nextVersion = (current?.version ?? 0) + 1;

  if (current) {
    const { error: archiveError } = await admin
      .from("personas")
      .update({ status: "ARCHIVED" } as never)
      .eq("id", current.id);
    if (archiveError) throw archiveError;
  }

  const { data, error } = await admin
    .from("personas")
    .insert({
      version: nextVersion,
      status: "ACTIVE",
      name: input.name ?? DEFAULT_PERSONA.name,
      address: input.address ?? DEFAULT_PERSONA.address,
      compiled_prompt: compiledPrompt,
      compiled_at: new Date().toISOString(),
    } as never)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Persona kon niet worden bewaard.");
  return mapPersona(data as Record<string, unknown>);
}

export function fallbackCompiledPrompt() {
  return compilePersona(DEFAULT_PERSONA);
}
