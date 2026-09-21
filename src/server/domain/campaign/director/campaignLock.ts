import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STALE_MS = 120_000;

export async function acquireCampaignLock(campaignId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const now = new Date().toISOString();

  const { data: current, error: readError } = await admin
    .from("campaigns")
    .select("progression_lock_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (readError) throw readError;
  const held = current?.progression_lock_at as string | null | undefined;
  if (held && new Date(held).getTime() > Date.now() - STALE_MS) return false;

  let update = admin
    .from("campaigns")
    .update({ progression_lock_at: now } as never)
    .eq("id", campaignId);
  update = held ? update.eq("progression_lock_at", held) : update.is("progression_lock_at", null);
  const { data, error } = await update.select("id").maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function releaseCampaignLock(campaignId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("campaigns")
    .update({ progression_lock_at: null } as never)
    .eq("id", campaignId);
  if (error) throw error;
}
