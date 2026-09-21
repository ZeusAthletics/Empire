/**
 * Run in-place chapter replan for the scoped player (Hardwig / operator).
 * Usage: tsx scripts/replan-chapter.ts [playerId]
 */
import { replanChapterInPlace } from "../src/server/domain/campaign/director/CampaignDirector";

const playerId = process.argv[2]?.trim();
if (!playerId) {
  console.error("Geef een playerId: tsx scripts/replan-chapter.ts <uuid>");
  process.exit(1);
}

const result = await replanChapterInPlace(playerId);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
