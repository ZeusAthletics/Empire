import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  MissionLockedError,
  attestObjective,
  type RewardMission,
} from "../src/server/validation/rewardEngine";

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

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function main() {
  const admin = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: player, error: playerError } = await admin
    .from("players")
    .select("id, xp, xp_to_next, level, lifetime_xp")
    .eq("display_name", "HARDWIG AERTS")
    .maybeSingle();
  if (playerError || !player) throw playerError ?? new Error("Speler niet gevonden.");

  const { data: missions, error: missionError } = await admin
    .from("missions")
    .select("id, seed_key, kind, status, xp_reward, xp_granted, stat_reward_key, stat_reward_amount")
    .eq("player_id", player.id)
    .is("deleted_at", null);
  if (missionError) throw missionError;

  const voka = missions?.find((row) => row.seed_key === "m-voka");
  const boss = missions?.find((row) => row.seed_key === "m-boss10k");
  const connector = missions?.find((row) => row.seed_key === "m-connector");
  assert.ok(voka, "VOKA-missie ontbreekt");
  assert.equal(voka.xp_reward, 250);
  assert.ok(boss, "Boss-missie ontbreekt");
  assert.equal(boss.status, "LOCKED");
  assert.ok(connector, "Connector-missie ontbreekt");
  assert.equal(connector.status, "ACTIVE");

  const { data: objectives, error: objError } = await admin
    .from("mission_objectives")
    .select("id, seed_key, optional, status")
    .eq("mission_id", connector.id)
    .is("deleted_at", null);
  if (objError) throw objError;
  const next = (objectives ?? []).find((row) => row.seed_key === "o3" && row.status === "OPEN");
  assert.ok(next, "Connector o3 moet open staan na seed");

  const xpBefore = player.xp as number;
  const rewardState: RewardMission = {
    kind: connector.kind as RewardMission["kind"],
    status: connector.status as RewardMission["status"],
    xpReward: connector.xp_reward as number,
    xpGranted: connector.xp_granted as number,
    statReward: { key: connector.stat_reward_key as string, amount: connector.stat_reward_amount as number },
    objectives: (objectives ?? []).map((row) => ({
      id: row.id as string,
      optional: Boolean(row.optional),
      status: row.status as "OPEN" | "COMPLETED" | "SKIPPED",
    })),
  };
  const result = attestObjective(rewardState, next.id as string);
  assert.equal(result.xpDelta, 50);

  const { error: evidenceError } = await admin.from("evidence").insert({
    player_id: player.id,
    kind: "USER_ATTESTED",
    mission_id: connector.id,
    objective_id: next.id,
    note: "Phase 4 verify",
  } as never);
  if (evidenceError) throw evidenceError;

  const { error: objUpdateError } = await admin
    .from("mission_objectives")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() } as never)
    .eq("id", next.id);
  if (objUpdateError) throw objUpdateError;

  const { error: missionUpdateError } = await admin
    .from("missions")
    .update({ xp_granted: result.xpGrantedTotal } as never)
    .eq("id", connector.id);
  if (missionUpdateError) throw missionUpdateError;

  const { error: xpError } = await admin
    .from("players")
    .update({
      xp: xpBefore + result.xpDelta,
      lifetime_xp: (player.lifetime_xp as number) + result.xpDelta,
    } as never)
    .eq("id", player.id);
  if (xpError) throw xpError;

  const { data: after } = await admin.from("players").select("xp").eq("id", player.id).single();
  assert.equal(after?.xp, xpBefore + 50);

  assert.throws(() => {
    attestObjective(
      {
        kind: "BOSS",
        status: "LOCKED",
        xpReward: 1000,
        xpGranted: 0,
        statReward: { key: "capital", amount: 6 },
        objectives: [{ id: "o1", optional: false, status: "OPEN" }],
      },
      "o1",
    );
  }, MissionLockedError);

  console.log("Phase 4 verify: Continue attests Connector o3 (+50 XP). Locked boss stays locked.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
