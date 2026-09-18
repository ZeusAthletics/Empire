import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapPlayer, type SessionPlayer } from "@/server/domain/player/types";
import type { PlayerRow, StatValueRow } from "@/server/domain/player/types";

export async function findPlayerByAuthUserId(authUserId: string): Promise<SessionPlayer | null> {
  const admin = createSupabaseAdminClient();
  const { data: player, error } = await admin
    .from("players")
    .select("*")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!player) return null;

  const { data: stats, error: statsError } = await admin
    .from("stat_values")
    .select("*")
    .eq("player_id", player.id)
    .is("deleted_at", null);

  if (statsError) throw statsError;

  return mapPlayer(player as PlayerRow, (stats ?? []) as StatValueRow[]);
}
