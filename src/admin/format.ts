export function money(cents: number) {
  return `€${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function relTime(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.round(ms / 36e5);
  if (Number.isNaN(hours)) return "—";
  if (hours < 1) return "net";
  if (hours < 24) return `${hours} u`;
  return `${Math.round(hours / 24)} d`;
}

export function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 6);
}

export function tagTone(value: string) {
  if (/PENDING|SURFACED|NEW|TENTATIVE|TIMEOUT|ERROR/.test(value)) return "amber";
  if (/APPROVED|CONFIRMED|ACTIVE|OK|EXPLICIT/.test(value)) return "jade";
  if (/REJECTED|CRITICAL|DISMISSED|EXPIRED/.test(value)) return "coral";
  if (/HIGH|LIKELY|STRATEGIC/.test(value)) return "violet";
  return "";
}
