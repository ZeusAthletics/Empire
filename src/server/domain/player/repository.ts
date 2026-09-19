import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { geocodePlace } from "@/server/domain/geo/geocode";
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

export async function findPlayerByDisplayName(displayName: string): Promise<SessionPlayer | null> {
  const admin = createSupabaseAdminClient();
  const { data: player, error } = await admin
    .from("players")
    .select("*")
    .eq("display_name", displayName)
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

export async function updateHomeAddress(playerId: string, raw: string): Promise<SessionPlayer> {
  const address = raw.trim();
  if (address.length < 5) throw new Error("Vul een straat, huisnummer en gemeente in.");
  const geo = await geocodePlace(address, { minPrecision: "street" });
  if (!geo) throw new Error("Dit adres is niet gevonden in België. Gebruik straat, nummer en gemeente.");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("players")
    .update({
      home_address: geo.address,
      home_lat: geo.lat,
      home_lng: geo.lng,
    } as never)
    .eq("id", playerId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error || !data) {
    if (error && /home_address|schema cache|column/i.test(error.message)) {
      throw new Error("Adreskolom ontbreekt nog in de database. Plak de Home Base SQL in Supabase.");
    }
    throw error ?? new Error("Home Base kon niet worden bewaard.");
  }
  return withStats(data as PlayerRow);
}
