/**
 * Run in-place chapter replan for the scoped player (Hardwig / operator).
 * Usage: tsx scripts/replan-chapter.ts [playerId]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { replanChapterInPlace } from "../src/server/domain/campaign/director/CampaignDirector";
import { findPlayerByDisplayName } from "../src/server/domain/player/repository";
import { SCOPED_PLAYER_NAME } from "../src/admin/scope";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnvFile(".env.local");

  const arg = process.argv[2]?.trim();
  let playerId = arg;
  if (!playerId) {
    const scoped = await findPlayerByDisplayName(SCOPED_PLAYER_NAME);
    if (!scoped) {
      console.error(`Speler ${SCOPED_PLAYER_NAME} niet gevonden. Geef een playerId.`);
      process.exit(1);
    }
    playerId = scoped.id;
  }

  const result = await replanChapterInPlace(playerId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
