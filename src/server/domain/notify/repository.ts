import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canTakeInterrupt, summarizeBudget, type InterruptEvent } from "@/server/domain/notify/budget";

async function listInterrupts(playerId: string): Promise<InterruptEvent[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("notification_interrupts")
    .select("at, kind")
    .eq("player_id", playerId)
    .order("at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []).map((row) => ({ at: row.at as string, kind: row.kind as string }));
}

export async function getNotificationBudget(playerId: string) {
  const events = await listInterrupts(playerId);
  return summarizeBudget(events);
}

export async function tryInterrupt(playerId: string, kind: string) {
  const events = await listInterrupts(playerId);
  if (!canTakeInterrupt(events)) {
    return { ok: false as const, reason: "budget op" as const };
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("notification_interrupts").insert({
    player_id: playerId,
    kind,
  } as never);
  if (error) throw error;
  return { ok: true as const };
}
