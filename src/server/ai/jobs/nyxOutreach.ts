import { runNyxOutreachTick } from "@/server/ai/services/NyxOutreachService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function runNyxOutreachJob() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("players").select("id").eq("role", "PLAYER");
  if (error) throw error;

  let players = 0;
  let sent = 0;
  for (const row of data ?? []) {
    players += 1;
    const result = await runNyxOutreachTick(row.id as string);
    if (result.action !== "SILENCE" && !result.skipped) sent += 1;
  }
  return { players, sent };
}
