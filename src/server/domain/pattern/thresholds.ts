import type { PatternObservation, PatternStatus } from "@/server/domain/pattern/types";

export const PATTERN_MIN_OBSERVATIONS = 3;
export const PATTERN_MIN_SPAN_DAYS = 14;
export const PATTERN_MIN_SOURCES = 2;

export function evaluatePattern(observations: PatternObservation[]): PatternStatus | "NONE" {
  if (observations.length === 0) return "NONE";
  if (observations.length === 1 && observations[0]?.type === "CHAT") return "NONE";

  const sources = new Set(observations.map((item) => item.type));
  const times = observations.map((item) => new Date(item.at).getTime()).sort((a, b) => a - b);
  const spanDays = (times[times.length - 1]! - times[0]!) / 86_400_000;

  if (
    observations.length >= PATTERN_MIN_OBSERVATIONS &&
    spanDays >= PATTERN_MIN_SPAN_DAYS &&
    sources.size >= PATTERN_MIN_SOURCES
  ) {
    return "SURFACED";
  }
  return "OBSERVING";
}

export function groupObservationsByTheme(observations: PatternObservation[]) {
  const groups = new Map<string, PatternObservation[]>();
  for (const item of observations) {
    const key = item.theme.trim().toLowerCase() || "algemeen";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}
