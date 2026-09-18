import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { applyPhase1Schema } from "./apply-schema";
import { STAT_KEYS, type Role, type StatKey } from "../src/server/domain/player/types";

function loadEnvFile(filename: string, override: boolean) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

const PLAYER_STATS: { key: StatKey; value: number }[] = [
  { key: "capital", value: 78 },
  { key: "income", value: 65 },
  { key: "ownership", value: 52 },
  { key: "network", value: 86 },
  { key: "authority", value: 73 },
  { key: "strategy", value: 69 },
  { key: "execution", value: 61 },
  { key: "optionality", value: 47 },
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

type Admin = ReturnType<typeof createClient>;

async function ensureAuthUser(admin: Admin, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error && data.user) return data.user;

  if (error && !/already been registered|already exists/i.test(error.message)) {
    throw error;
  }

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    throw new Error(`Auth user ${email} already exists but could not be loaded.`);
  }
  return existing;
}

async function upsertPlayer(
  admin: Admin,
  input: {
    authUserId: string;
    role: Role;
    displayName: string;
    title: string;
    level: number;
    xp: number;
    xpToNext: number;
    lifetimeXp: number;
    stats: { key: StatKey; value: number }[];
  },
) {
  const { data: player, error } = await admin
    .from("players")
    .upsert(
      {
        auth_user_id: input.authUserId,
        role: input.role,
        display_name: input.displayName,
        title: input.title,
        level: input.level,
        xp: input.xp,
        xp_to_next: input.xpToNext,
        lifetime_xp: input.lifetimeXp,
        deleted_at: null,
      } as never,
      { onConflict: "auth_user_id" },
    )
    .select("id, display_name")
    .single();

  if (error || !player) throw error ?? new Error("Player upsert returned no row.");

  const { error: statsError } = await admin.from("stat_values").upsert(
    input.stats.map((stat) => ({
      player_id: player.id,
      key: stat.key,
      value: stat.value,
      deleted_at: null,
    })) as never,
    { onConflict: "player_id,key" },
  );

  if (statsError) throw statsError;
  return player;
}

async function tablesReady(admin: Admin) {
  const { error } = await admin.from("players").select("id").limit(1);
  return !error;
}

async function main() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const playerEmail = requiredEnv("SEED_PLAYER_EMAIL");
  const playerPassword = requiredEnv("SEED_PLAYER_PASSWORD");
  const adminEmail = requiredEnv("SEED_ADMIN_EMAIL");
  const adminPassword = requiredEnv("SEED_ADMIN_PASSWORD");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!(await tablesReady(admin))) {
    console.log("players table missing — applying phase 1 SQL…");
    try {
      await applyPhase1Schema();
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n\nOpen the Supabase SQL Editor, paste supabase/migrations/20260918120000_phase1_player.sql, run it, then retry npm run db:seed.`,
      );
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
    if (!(await tablesReady(admin))) {
      throw new Error(
        "Table public.players is still missing after applying SQL. Open the Supabase SQL Editor, paste supabase/migrations/20260918120000_phase1_player.sql, run it, then retry npm run db:seed.",
      );
    }
  }

  const playerAuth = await ensureAuthUser(admin, playerEmail, playerPassword);
  const adminAuth = await ensureAuthUser(admin, adminEmail, adminPassword);

  const player = await upsertPlayer(admin, {
    authUserId: playerAuth.id,
    role: "PLAYER",
    displayName: "HARDWIG AERTS",
    title: "STRATEGIC OPERATOR",
    level: 12,
    xp: 7420,
    xpToNext: 10000,
    lifetimeXp: 24860,
    stats: PLAYER_STATS,
  });

  const operator = await upsertPlayer(admin, {
    authUserId: adminAuth.id,
    role: "ADMIN",
    displayName: "EMPIRE OPS",
    title: "OPERATOR",
    level: 1,
    xp: 0,
    xpToNext: 1000,
    lifetimeXp: 0,
    stats: STAT_KEYS.map((key) => ({ key, value: 0 })),
  });

  console.log(`Seeded player ${player.display_name} (${playerEmail})`);
  console.log(`Seeded admin ${operator.display_name} (${adminEmail})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
