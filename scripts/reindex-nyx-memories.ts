/**
 * One-off: walk Nyx chat history and run the same memory extraction as live chat.
 *
 * Usage:
 *   npx tsx scripts/reindex-nyx-memories.ts
 *   npx tsx scripts/reindex-nyx-memories.ts --player "HARDWIG AERTS"
 *   npx tsx scripts/reindex-nyx-memories.ts --dry-run
 *   npx tsx scripts/reindex-nyx-memories.ts --use-model --limit 50
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { afterNyxReply, collectTurnCandidates } from "../src/server/ai/services/MemoryExtractionService";
import { openaiConfigured } from "../src/server/ai/client/openai";
import { pairNyxChatTurns, type NyxHistoryMessage } from "../src/server/domain/nyx/historyTurns";
import { listActiveMemories } from "../src/server/domain/memory/repository";
import { applyMemoryDecision } from "../src/server/validation/MemoryValidationService";

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

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

const PAGE = 400;

async function loadAllMessages(admin: ReturnType<typeof createClient>, playerId: string): Promise<NyxHistoryMessage[]> {
  const rows: NyxHistoryMessage[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("nyx_messages")
      .select("id, role, content, created_at")
      .eq("player_id", playerId)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      rows.push({
        id: row.id as string,
        role: row.role as NyxHistoryMessage["role"],
        content: String(row.content ?? ""),
        createdAt: row.created_at as string,
      });
    }
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

function sleep(ms: number) {
  return new Promise((done) => setTimeout(done, ms));
}

async function main() {
  const playerName = argValue("--player") ?? "HARDWIG AERTS";
  const dryRun = hasFlag("--dry-run");
  const useModel = hasFlag("--use-model");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10)) : undefined;
  const fromDate = argValue("--from");

  if (useModel && !openaiConfigured()) {
    console.warn("--use-model ignored: OPENAI_API_KEY ontbreekt. Offline extractie only.");
  }

  const admin = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: player, error: playerError } = await admin
    .from("players")
    .select("id, display_name")
    .eq("display_name", playerName)
    .maybeSingle();
  if (playerError || !player) throw playerError ?? new Error(`Speler niet gevonden: ${playerName}`);

  const playerId = player.id as string;
  console.log(`Reindex Nyx memories · ${player.display_name} · ${dryRun ? "DRY RUN" : "LIVE"}`);

  const messages = await loadAllMessages(admin, playerId);
  let turns = pairNyxChatTurns(messages);
  if (fromDate) {
    const cut = new Date(fromDate).getTime();
    turns = turns.filter((turn) => new Date(turn.createdAt).getTime() >= cut);
  }
  if (limit) turns = turns.slice(0, limit);

  console.log(`Berichten: ${messages.length} · Beurten: ${turns.length}`);

  const stats = { auto: 0, proposal: 0, observe: 0, skip: 0, revision: 0, errors: 0 };

  if (dryRun) {
    const existing = await listActiveMemories(playerId).catch(() => []);
    for (const [index, turn] of turns.entries()) {
      try {
        const candidates = await collectTurnCandidates({
          playerId,
          userText: turn.userText,
          nyxText: turn.nyxText,
          useModel: useModel && openaiConfigured(),
        });
        for (const candidate of candidates) {
          const decision = applyMemoryDecision(candidate, existing);
          if (decision.store === "AUTO") stats.auto += 1;
          else if (decision.store === "PROPOSAL") stats.proposal += 1;
          else if (decision.store === "REVISION") stats.revision += 1;
          else if (decision.store === "OBSERVE") stats.observe += 1;
          else stats.skip += 1;
        }
        if (useModel && openaiConfigured() && (index + 1) % 5 === 0) {
          process.stdout.write(`  … ${index + 1}/${turns.length}\n`);
          await sleep(250);
        }
      } catch {
        stats.errors += 1;
      }
    }
  } else {
    for (const [index, turn] of turns.entries()) {
      try {
        await afterNyxReply({
          playerId,
          userText: turn.userText,
          nyxText: turn.nyxText,
          sourceId: turn.userMessageId,
          useModel: useModel && openaiConfigured(),
        });
        if (useModel && openaiConfigured()) await sleep(300);
        if ((index + 1) % 25 === 0) process.stdout.write(`  … ${index + 1}/${turns.length}\n`);
      } catch (err) {
        stats.errors += 1;
        console.error(`Turn ${turn.userMessageId}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  if (dryRun) {
    console.log("Dry-run klaar (geen DB writes).");
    console.log(
      `  AUTO=${stats.auto} PROPOSAL=${stats.proposal} REVISION=${stats.revision} OBSERVE=${stats.observe} SKIP=${stats.skip} errors=${stats.errors}`,
    );
  } else {
    console.log(`Klaar. Beurten verwerkt: ${turns.length}. errors=${stats.errors}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
