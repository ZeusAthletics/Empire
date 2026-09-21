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

async function applySqlFile(relativePath: string, label: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service role key.");

  const sql = readFileSync(resolve(process.cwd(), relativePath), "utf8");
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
    await response.text();
    if (response.ok) {
      console.log(`Applied ${label}.`);
      return;
    }
    errors.push(`${attempt.endpoint} → ${response.status}`);
  }

  throw new Error(`Schema apply failed for ${label} (${errors.join("; ")})`);
}

export async function applyPhase1Schema() {
  await applySqlFile("supabase/migrations/20260918120000_phase1_player.sql", "phase 1 schema");
}

export async function applyPhase3Schema() {
  await applySqlFile("supabase/migrations/20260918210000_phase3_campaign.sql", "phase 3 schema");
}

export async function applyPhase4Schema() {
  await applySqlFile("supabase/migrations/20260918220000_phase4_missions.sql", "phase 4 schema");
}

export async function applyPhase5Schema() {
  await applySqlFile("supabase/migrations/20260918230000_phase5_map.sql", "phase 5 schema");
}

export async function applyPhase6Schema() {
  await applySqlFile("supabase/migrations/20260919010000_phase6_journal.sql", "phase 6 schema");
}

export async function applyPhase7Schema() {
  await applySqlFile("supabase/migrations/20260919020000_phase7_nyx_talk.sql", "phase 7 nyx talk schema");
}

export async function applyPhase8Schema() {
  await applySqlFile("supabase/migrations/20260919030000_phase8_memory.sql", "phase 8 memory schema");
}

export async function applyPhase9Schema() {
  await applySqlFile("supabase/migrations/20260919040000_phase9_think.sql", "phase 9 think schema");
}

export async function applyPhase10Schema() {
  await applySqlFile("supabase/migrations/20260919050000_phase10_radar.sql", "phase 10 radar schema");
}

export async function applyPhase11Schema() {
  await applySqlFile("supabase/migrations/20260919060000_phase11_ops.sql", "phase 11 ops schema");
}

export async function applyIntakeSchema() {
  await applySqlFile("supabase/migrations/20260919180000_intake_and_covers.sql", "intake and covers schema");
}

export async function applyNyxIdentityOutreachSchema() {
  await applySqlFile(
    "supabase/migrations/20260920100000_nyx_identity_outreach.sql",
    "nyx identity and outreach schema",
  );
}

export async function applyNyxIdentityFacePromptSchema() {
  await applySqlFile(
    "supabase/migrations/20260920110000_nyx_identity_face_prompt.sql",
    "nyx identity face prompt settings",
  );
}

export async function applyNyxCuratedLibrarySchema() {
  await applySqlFile(
    "supabase/migrations/20260920120000_nyx_curated_library.sql",
    "nyx curated library schema",
  );
}

export async function applyNyxMessageMediaContextSchema() {
  await applySqlFile(
    "supabase/migrations/20260920130000_nyx_message_media_context.sql",
    "nyx message media context",
  );
}

export async function applyNyxMessageSeenSchema() {
  await applySqlFile(
    "supabase/migrations/20260920140000_nyx_message_seen.sql",
    "nyx message seen at for media badge",
  );
}

export async function applyNyxChatAttachmentsSchema() {
  await applySqlFile(
    "supabase/migrations/20260921100000_nyx_chat_attachments.sql",
    "nyx chat attachments and links",
  );
}
