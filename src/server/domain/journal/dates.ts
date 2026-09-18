export const WEEKDAYS_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"] as const;
export const MONTHS_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

export function monthIdFrom(at: Date | string | number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(id: string): string {
  const [year, month] = id.split("-");
  const name = MONTHS_NL[Number(month) - 1] ?? month;
  return `${name} ${year}`.toUpperCase();
}

export function formatTime(at: Date | string | number): string {
  return new Date(at).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateLabel(at: Date | string | number): string {
  const date = new Date(at);
  return `${WEEKDAYS_NL[date.getDay()]} ${date.getDate()} ${MONTHS_NL[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

export function titleFromBody(text: string): string {
  const firstLine = text.split(/[.\n]/)[0]?.trim() ?? "";
  if (!firstLine) return "Quick note";
  return firstLine.length > 46 ? `${firstLine.slice(0, 44)}…` : firstLine;
}
