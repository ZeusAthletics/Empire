export const DEFAULT_PLAYER_TIMEZONE = "Europe/Brussels";
export const DAYTIME_START_HOUR = 8;
export const DAYTIME_END_HOUR = 22;

export type PlayerLocalTime = {
  timeZone: string;
  isoLocal: string;
  dateLabel: string;
  timeLabel: string;
  weekday: string;
  dayPart: string;
  hour: number;
  isDaytime: boolean;
};

function partsInZone(timeZone: string, now: Date) {
  const fmt = new Intl.DateTimeFormat("nl-BE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: Number.isFinite(hour) ? hour : 12,
    minute: get("minute"),
    weekday: get("weekday"),
  };
}

function dayPartForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "ochtend";
  if (hour >= 12 && hour < 18) return "middag";
  if (hour >= 18 && hour < 23) return "avond";
  return "nacht";
}

export function isValidTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export function normalizePlayerTimeZone(timeZone: string | null | undefined): string {
  const trimmed = timeZone?.trim();
  if (trimmed && isValidTimeZone(trimmed)) return trimmed;
  return DEFAULT_PLAYER_TIMEZONE;
}

export function formatPlayerLocalTime(timeZone: string, now = new Date()): PlayerLocalTime {
  const tz = normalizePlayerTimeZone(timeZone);
  const p = partsInZone(tz, now);
  const dateFmt = new Intl.DateTimeFormat("nl-BE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("nl-BE", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const hour = p.hour;
  const isDaytime = hour >= DAYTIME_START_HOUR && hour < DAYTIME_END_HOUR;
  const dayPart = dayPartForHour(hour);
  return {
    timeZone: tz,
    isoLocal: `${p.year}-${p.month}-${p.day}T${p.hour.toString().padStart(2, "0")}:${p.minute}`,
    dateLabel: dateFmt.format(now),
    timeLabel: timeFmt.format(now),
    weekday: p.weekday,
    dayPart,
    hour,
    isDaytime,
  };
}

export function formatPlayerLocalTimeLine(local: PlayerLocalTime): string {
  return `Lokaal bij Hardwig: ${local.dateLabel}, ${local.timeLabel} (${local.timeZone}, ${local.dayPart})`;
}
