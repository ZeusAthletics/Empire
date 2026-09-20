import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findPlayerByDisplayName } from "@/server/domain/player/repository";
import type { SessionPlayer } from "@/server/domain/player/types";

export const SCOPED_PLAYER_NAME = "HARDWIG AERTS";

export async function resolveAdminScope(operator: SessionPlayer, path: string) {
  const scoped = await findPlayerByDisplayName(SCOPED_PLAYER_NAME);
  if (!scoped) throw new Error("Speler HARDWIG AERTS ontbreekt. Draai npm run db:seed.");

  if (scoped.id !== operator.id) {
    const admin = createSupabaseAdminClient();
    const { error: logError } = await admin.from("admin_access_log").insert({
      admin_player_id: operator.id,
      scoped_player_id: scoped.id,
      path,
    } as never);
    if (logError) {
      // Scope resolution must not fail if audit log insert fails.
    }
  }

  return scoped;
}
