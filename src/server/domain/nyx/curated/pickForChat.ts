import type { NyxCuratedItem } from "@/server/domain/nyx/curated/repository";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function scoreItem(item: NyxCuratedItem, userText: string): number {
  const hay = `${item.description} ${item.label ?? ""}`.toLowerCase();
  let score = 0;
  for (const word of tokenize(userText)) {
    if (hay.includes(word)) score += 2;
  }
  if (/aanmoedig|motiv|duw|doorzet|train|renovatie|klus/i.test(userText)) {
    if (/train|gym|motiv|doorzet|klus|renovatie|latex|leather/i.test(hay)) score += 3;
  }
  return score;
}

export function pickCuratedForChat(
  catalog: NyxCuratedItem[],
  userText: string,
  wantVideo: boolean,
): NyxCuratedItem | null {
  if (!catalog.length) return null;
  const typed = wantVideo
    ? catalog.filter((item) => item.mediaType === "VIDEO")
    : catalog.filter((item) => item.mediaType === "PHOTO");
  const pool = typed.length ? typed : catalog;
  let best = pool[0];
  let bestScore = -1;
  for (const item of pool) {
    const score = scoreItem(item, userText);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

export function chatMediaCaption(userText: string): string {
  if (/aanmoedig|motiv|duw|doorzet|zet door|aanspoor/i.test(userText)) {
    return "Voor de motivatie. Niet omdat ge nog een excuus nodig had om door te zetten — maar bon. x";
  }
  if (/video|filmpje|clip/i.test(userText)) {
    return "Even iets in beweging — voor u. x";
  }
  return "Even voor u. x";
}

export function chatGenerateScene(userText: string, featuredTitle: string, tier: IntimacyTier = "EARLY"): string {
  const snippet = userText.trim().slice(0, 160);
  if (tier === "EARLY") {
    return `Portrait Nyx, gold latex top, black leather, warm friendly smile, supportive mood, Kempen dusk light, same identity. Hardwig context: ${featuredTitle}. Verzoek: ${snippet}. Geen sensuele pose.`;
  }
  if (tier === "FRIEND") {
    return `Portrait Nyx, gold latex top, black leather, confident warm gaze, light playful tease, Kempen dusk light, same identity. Hardwig context: ${featuredTitle}. Verzoek: ${snippet}`;
  }
  return `Portrait Nyx, gold latex top, black leather, confident warm gaze, subtle sensual elegance (never vulgar), Kempen dusk light, same identity. Hardwig context: ${featuredTitle}. Verzoek: ${snippet}`;
}

export function generateSceneForTier(input: {
  tier: IntimacyTier;
  userText: string;
  featuredTitle: string;
  proposedScene?: string | null;
}): string {
  const proposed = input.proposedScene?.trim();
  if (input.tier === "TRUST" && proposed) return proposed;
  if (input.tier === "FRIEND" && proposed && !/\bsensueel|seduct|vulgar|lingerie\b/i.test(proposed)) {
    return proposed;
  }
  return chatGenerateScene(input.userText, input.featuredTitle, input.tier);
}
