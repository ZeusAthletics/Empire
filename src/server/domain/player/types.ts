export type Role = "PLAYER" | "ADMIN";

export type StatKey =
  | "capital"
  | "income"
  | "ownership"
  | "network"
  | "authority"
  | "strategy"
  | "execution"
  | "optionality";

export const STAT_KEYS: StatKey[] = [
  "capital",
  "income",
  "ownership",
  "network",
  "authority",
  "strategy",
  "execution",
  "optionality",
];

export type PlayerRow = {
  id: string;
  auth_user_id: string;
  role: Role;
  display_name: string;
  title: string;
  level: number;
  xp: number;
  xp_to_next: number;
  lifetime_xp: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  home_address?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
};

export type StatValueRow = {
  id: string;
  player_id: string;
  key: StatKey;
  value: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PublicPlayer = {
  id: string;
  displayName: string;
  title: string;
  role: Role;
  level: number;
  xp: number;
  xpToNext: number;
  lifetimeXp: number;
  homeAddress: string | null;
  stats: { key: StatKey; value: number }[];
};

export type SessionPlayer = PublicPlayer & {
  authUserId: string;
};

export function mapPlayer(row: PlayerRow, stats: StatValueRow[]): SessionPlayer {
  const byKey = new Map(stats.map((stat) => [stat.key, stat.value]));
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    role: row.role,
    displayName: row.display_name,
    title: row.title,
    level: row.level,
    xp: row.xp,
    xpToNext: row.xp_to_next,
    lifetimeXp: row.lifetime_xp,
    homeAddress: row.home_address ?? null,
    stats: STAT_KEYS.map((key) => ({ key, value: byKey.get(key) ?? 0 })),
  };
}
