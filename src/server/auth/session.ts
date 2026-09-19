import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findPlayerByAuthUserId } from "@/server/domain/player/repository";
import type { PublicPlayer, SessionPlayer } from "@/server/domain/player/types";

export type { PublicPlayer, SessionPlayer };

export async function getSessionPlayer(): Promise<SessionPlayer | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return findPlayerByAuthUserId(user.id);
}

export async function requireAdmin() {
  const player = await getSessionPlayer();
  if (!player || player.role !== "ADMIN") return null;
  return player;
}

export function toPublicPlayer(player: SessionPlayer): PublicPlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    title: player.title,
    role: player.role,
    level: player.level,
    xp: player.xp,
    xpToNext: player.xpToNext,
    lifetimeXp: player.lifetimeXp,
    stats: player.stats,
  };
}
