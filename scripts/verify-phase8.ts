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
  const chapterBefore = { roman: chapter.roman, name: chapter.name };

  const { data: memories, error: memoryError } = await admin
    .from("memories")
    .select("id, normalized_fact, importance, confidence")
    .eq("player_id", player.id)
    .eq("status", "ACTIVE");
  if (memoryError) throw memoryError;
  assert.ok((memories ?? []).some((row) => row.normalized_fact === "vrijheid is kritiek"), "Kritieke memory ontbreekt");
  assert.ok((memories ?? []).some((row) => row.normalized_fact === "werkt het liefst vroeg"), "Tentatieve memory ontbreekt");

  const { data: chip, error: chipError } = await admin
    .from("proposals")
    .select("id, kind, status")
    .eq("player_id", player.id)
    .eq("seed_key", "nm1")
    .maybeSingle();
  if (chipError) throw chipError;
  assert.ok(chip, "Onthouden-voorstel ontbreekt");

  const { data: created, error: createError } = await admin
    .from("memories")
    .insert({
      player_id: player.id,
      domain: "PREFERENCE",
      category: "LIFESTYLE_PREFERENCE",
      content: "Phase 8 verify.",
      normalized_fact: "phase 8 verify koffie",
      confidence: "LIKELY",
      importance: "LOW",
      status: "ACTIVE",
      source_type: "CHAT",
    } as never)
    .select("id")
    .single();
  if (createError || !created) throw createError ?? new Error("Memory aanmaken mislukt.");

  const { error: versionError } = await admin.from("memory_versions").insert({
    memory_id: created.id,
    snapshot: { normalizedFact: "phase 8 verify koffie" },
    changed_by: "SYSTEM",
    reason: "verify",
  } as never);
  if (versionError) throw versionError;

  const { error: rejectError } = await admin
    .from("memories")
    .update({ status: "REJECTED" } as never)
    .eq("id", created.id);
  if (rejectError) throw rejectError;

  const { data: stillActive, error: activeError } = await admin
    .from("memories")
    .select("id")
    .eq("id", created.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (activeError) throw activeError;
  assert.equal(stillActive, null);

  const { data: chapterAfter, error: afterError } = await admin
    .from("chapters")
    .select("roman, name")
    .eq("id", chapter.id)
    .maybeSingle();
  if (afterError) throw afterError;
  assert.deepEqual(chapterAfter, chapterBefore);

  console.log("Phase 8 verify: memories + versions. Tentative preference liet hoofdstuk I staan.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
