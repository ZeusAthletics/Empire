import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

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
    if (override || process.env[key] === undefined) process.env[key] = value;
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
    .select("id")
    .eq("display_name", "HARDWIG AERTS")
    .maybeSingle();
  if (playerError || !player) throw playerError ?? new Error("Speler niet gevonden.");

  const { data: geel, error: geelError } = await admin
    .from("opportunities")
    .select("title, relevance_score, reasons_for_relevance, status")
    .eq("player_id", player.id)
    .eq("seed_key", "op-geel")
    .maybeSingle();
  if (geelError) throw geelError;
  assert.ok(geel, "Geel-event ontbreekt");
  assert.ok(Number(geel.relevance_score) > 80, "Geel moet hoog scoren");
  assert.match((geel.reasons_for_relevance as string[]).join(" "), /netwerk/i);

  const { data: hidden, error: hiddenError } = await admin
    .from("opportunities")
    .select("relevance_score, status")
    .eq("player_id", player.id)
    .eq("seed_key", "op-jdi")
    .maybeSingle();
  if (hiddenError) throw hiddenError;
  assert.ok(hidden);
  assert.equal(Number(hidden.relevance_score), 0);

  const { count, error: missionError } = await admin
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("player_id", player.id)
    .eq("origin_proposal_id", "00000000-0000-0000-0000-000000000000");
  if (missionError) throw missionError;
  void count;

  console.log("Phase 10 verify: Geel ranks high with a network reason. Restricted item stays at 0.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
