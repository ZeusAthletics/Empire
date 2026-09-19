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

  const { data: chapter, error: chapterError } = await admin
    .from("chapters")
    .select("id, roman, name")
    .eq("player_id", player.id)
    .eq("roman", "I")
    .is("deleted_at", null)
    .maybeSingle();
  if (chapterError) throw chapterError;
  assert.ok(chapter, "Hoofdstuk I ontbreekt");

  const { data: pattern, error: patternError } = await admin
    .from("strategic_patterns")
    .select("id, status, title")
    .eq("player_id", player.id)
    .eq("seed_key", "theme:optionality")
    .maybeSingle();
  if (patternError) throw patternError;
  assert.ok(pattern, "Seed-patroon ontbreekt");
  assert.notEqual(pattern.status, "OBSERVING");

  const { data: review, error: reviewError } = await admin
    .from("proposals")
    .select("id, kind")
    .eq("player_id", player.id)
    .eq("seed_key", "nr1")
    .maybeSingle();
  if (reviewError) throw reviewError;
  assert.ok(review, "Campagne-review ontbreekt");

  const { data: chapterAfter, error: afterError } = await admin
    .from("chapters")
    .select("id, roman, name")
    .eq("id", chapter.id)
    .maybeSingle();
  if (afterError) throw afterError;
  assert.equal(chapterAfter?.id, chapter.id);
  assert.equal(chapterAfter?.roman, "I");

  console.log("Phase 9 verify: surfaced pattern + review. Chapter I blijft staan.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
