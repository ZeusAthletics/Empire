import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

export async function applyPhase1Schema() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service role key.");

  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260918120000_phase1_player.sql"),
    "utf8",
  );

  const projectRef = new URL(url).hostname.split(".")[0];
  const attempts: { endpoint: string; body: unknown; extraHeaders?: Record<string, string> }[] = [
    {
      endpoint: `${url.replace(/\/$/, "")}/pg/query`,
      body: { query: sql },
    },
    {
      endpoint: `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      body: { query: sql },
    },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    const response = await fetch(attempt.endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...attempt.extraHeaders,
      },
      body: JSON.stringify(attempt.body),
    });
    const text = await response.text();
    if (response.ok) {
      console.log("Applied phase 1 schema.");
      return;
    }
    errors.push(`${attempt.endpoint} → ${response.status}`);
  }

  throw new Error(`Schema apply failed (${errors.join("; ")})`);
}
