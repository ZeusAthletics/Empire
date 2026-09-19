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

  for (const table of ["personas", "media_assets", "admin_access_log"]) {
    const { error } = await admin.from(table).select("id").limit(1);
    assert.equal(error, null, `${table} ontbreekt. Plak supabase/migrations/20260919060000_phase11_ops.sql.`);
  }

  const { data: persona, error } = await admin.from("personas").select("version, status, address").eq("status", "ACTIVE").maybeSingle();
  if (error) throw error;
  assert.ok(persona, "Geen actieve persona. Draai npm run db:seed.");
  assert.equal(persona.address, "u");
  console.log(`Phase 11 OK — persona@${persona.version} actief`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
