import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

export type OutreachAction = "SILENCE" | "TEXT" | "PHOTO" | "VIDEO";

export async function logOutreachRun(input: {
  playerId: string;
  action: OutreachAction;
  reason: string;
  intimacyTier?: IntimacyTier | null;
  mediaId?: string | null;
  messageId?: string | null;
  runId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("nyx_outreach_runs").insert({
    player_id: input.playerId,
    action: input.action,
    reason: input.reason,
    intimacy_tier: input.intimacyTier ?? null,
    media_id: input.mediaId ?? null,
    message_id: input.messageId ?? null,
    run_id: input.runId ?? null,
  } as never);
  if (error) throw error;
}
