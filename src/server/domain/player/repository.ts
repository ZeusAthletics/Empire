import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapPlayer, type SessionPlayer } from "@/server/domain/player/types";
import type { PlayerRow, StatValueRow } from "@/server/domain/player/types";

async function withStats(player: PlayerRow): Promise<SessionPlayer> {
  const admin = createSupabaseAdminClient();
  const { data: stats, error: statsError } = await admin
    .from("stat_values")
    .select("*")
    .eq("player_id", player.id)
    .is("deleted_at", null);
  if (statsError) throw statsError;
  return mapPlayer(player, (stats ?? []) as StatValueRow[]);
}

export async function findPlayerById(playerId: string): Promise<SessionPlayer | null> {
  const admin = createSupabaseAdminClient();
  const { data: player, error } = await admin
    .from("players")
    .select("*")
    .eq("id", playerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!player) return null;
  return withStats(player as PlayerRow);
}

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
  return withStats(player as PlayerRow);
}
