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

  const { data: entries, error: entryError } = await admin
    .from("journal_entries")
    .select("id")
    .eq("player_id", player.id)
    .is("deleted_at", null);
  if (entryError) throw entryError;
  assert.ok((entries ?? []).length >= 9, "Seed-journal ontbreekt");

  const { data: wrap, error: wrapError } = await admin
    .from("monthly_wraps")
    .select("month_id, label")
    .eq("player_id", player.id)
    .eq("month_id", "2026-08")
    .is("deleted_at", null)
    .maybeSingle();
  if (wrapError) throw wrapError;
  assert.ok(wrap, "Augustus-wrap ontbreekt");
  assert.equal(wrap.label, "AUGUSTUS 2026");

  const { data: created, error: createError } = await admin
    .from("journal_entries")
    .insert({
      player_id: player.id,
      title: "Phase 6 verify",
      body: "Quick note blijft in Supabase.",
      icon: "edit",
      tags: ["QUICK NOTE"],
      source: "USER",
    } as never)
    .select("id, title")
    .single();
  if (createError || !created) throw createError ?? new Error("Journal entry aanmaken mislukt.");
  assert.equal(created.title, "Phase 6 verify");

  const { data: generated, error: genError } = await admin
    .from("monthly_wraps")
    .insert({
      player_id: player.id,
      month_id: "2099-01",
      label: "VERIFY WRAP",
      year: 2099,
      events: 1,
      new_contacts: 1,
      missions_completed: 1,
      empire_delta: 1,
      deltas: { network: 1 },
      biggest_win: "verify",
      biggest_mistake: "verify",
      best_relationship: "verify",
      key_decision: "verify",
      best_mission: "verify",
      time_sink: "verify",
      what_changed: "verify",
      nyx: "verify",
      generated_at: new Date().toISOString(),
      source: "USER",
    } as never)
    .select("id")
    .single();
  if (genError || !generated) throw genError ?? new Error("Wrap aanmaken mislukt.");

  const { error: delError } = await admin
    .from("journal_entries")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", created.id);
  if (delError) throw delError;

  const { error: wrapDelError } = await admin
    .from("monthly_wraps")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", generated.id);
  if (wrapDelError) throw wrapDelError;

  console.log("Phase 6 verify: 9 entries + Augustus wrap. Quick note blijft in Supabase.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
