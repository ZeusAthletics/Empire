import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import type { PlayerLocalTime } from "@/server/domain/player/localTime";

function greet(local: PlayerLocalTime): string {
  if (local.dayPart === "ochtend") return "Goedemorgen";
  if (local.dayPart === "middag") return "Goedemiddag";
  if (local.dayPart === "avond") return "Goedenavond";
  return "Hallo";
}

export function offlineCheckInMessage(tier: IntimacyTier, local: PlayerLocalTime, hoursSilent: number): string {
  const g = greet(local);
  const since = hoursSilent >= 24 ? "een dag of langer" : "even";
  if (tier === "TRUST") {
    return `${g}. Ik merkte dat we ${since} niet gesproken hebben — ik wilde even horen hoe het met u zit.`;
  }
  if (tier === "FRIEND") {
    return `${g}. Het is ${since} stil geweest. Waar ligt uw focus vandaag?`;
  }
  return `${g}. Even inchecken — ${since} geen berichten. Wat staat er vandaag op het plan?`;
}
