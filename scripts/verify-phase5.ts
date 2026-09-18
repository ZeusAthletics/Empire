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

  const { data: home, error: homeError } = await admin
    .from("map_pins")
    .select("id, pin_type, locked_by_admin")
    .eq("player_id", player.id)
    .eq("seed_key", "p-home")
    .is("deleted_at", null)
    .maybeSingle();
  if (homeError) throw homeError;
  assert.ok(home, "Home Base pin ontbreekt");
  assert.equal(home.pin_type, "home");
  assert.equal(home.locked_by_admin, true);

  const { data: companies, error: companyError } = await admin
    .from("companies")
    .select("id")
    .eq("player_id", player.id)
    .is("deleted_at", null);
  if (companyError) throw companyError;
  assert.equal((companies ?? []).length, 4);

  const { data: created, error: createError } = await admin
    .from("map_pins")
    .insert({
      player_id: player.id,
      title: "Phase 5 verify",
      pin_type: "saved",
      lat: 51.08,
      lng: 4.73,
      note: "long-press persist",
      custom: true,
      source: "USER",
    } as never)
    .select("id")
    .single();
  if (createError || !created) throw createError ?? new Error("Pin aanmaken mislukt.");

  const { data: loaded, error: loadError } = await admin
    .from("map_pins")
    .select("id, title, custom")
    .eq("id", created.id)
    .maybeSingle();
  if (loadError) throw loadError;
  assert.equal(loaded?.title, "Phase 5 verify");
  assert.equal(loaded?.custom, true);

  const { error: delError } = await admin
    .from("map_pins")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", created.id);
  if (delError) throw delError;

  console.log("Phase 5 verify: Home Base + 4 bedrijven. Eigen pin blijft in Supabase.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
