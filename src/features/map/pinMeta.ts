import type { MapPin, MapPinType } from "@/server/domain/map/types";

const PATHS: Record<string, string> = {
  home: "M4 11.6 12 4.2l8 7.4V20a1 1 0 0 1-1 1h-4.2v-6H9.2v6H5a1 1 0 0 1-1-1z",
  target:
    "M12 4.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6zM12 8.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zM12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4",
  flag: "M5.2 21V3.6h9.4l-1.6 3.6 1.6 3.6H5.2",
  shield: "M12 3.2 19 6v6c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6zM9.4 11.6l2.2 2.2 3.4-3.8",
  users:
    "M9.2 4.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zM2.8 19.8c0-3.4 2.8-5.2 6.4-5.2s6.4 1.8 6.4 5.2M16.4 5.4a3.4 3.4 0 0 1 0 6.4M17.6 15c2.6.5 3.9 2.2 3.9 4.8",
  build: "M4.2 3.6h9.6v17.2H4.2zM13.8 9.4h6v11.4h-6M7 7.4h1.6M10.4 7.4H12M7 11.4h1.6M10.4 11.4H12M16 13h1.6",
  cal: "M4 5.6h16v15H4zM4 10.4h16M8.4 3v4M15.6 3v4",
  gem: "M12 3.2l5.4 5.6L12 20.8 6.6 8.8zM6.6 8.8h10.8",
  bookmark: "M7 3.4h10v17.2L12 16.6 7 20.6z",
  lock: "M5.6 11.4h12.8v9H5.6zM8.8 11.4V8.2a3.2 3.2 0 0 1 6.4 0v3.2",
};

export const PIN_META: Record<
  MapPinType,
  { label: string; icon: string; fill: string; stroke: string; glyph: string }
> = {
  home: { label: "Home Base", icon: "home", fill: "#1B3A2B", stroke: "#4FBF8B", glyph: "#9BE8C4" },
  main: { label: "Main Mission", icon: "target", fill: "#3A2A0E", stroke: "#C9A34E", glyph: "#F6ECDF" },
  side: { label: "Side Quest", icon: "flag", fill: "#241D12", stroke: "#8A6C2A", glyph: "#E4C782" },
  boss: { label: "Boss Mission", icon: "shield", fill: "#3A0F20", stroke: "#F05252", glyph: "#FFD7D7" },
  contact: { label: "Contact", icon: "users", fill: "#221E19", stroke: "#F6ECDF", glyph: "#F6ECDF" },
  company: { label: "Bedrijf", icon: "build", fill: "#2E1D0C", stroke: "#FF9A3C", glyph: "#FFD9AE" },
  event: { label: "Event", icon: "cal", fill: "#2A220E", stroke: "#C9A34E", glyph: "#F6ECDF" },
  opportunity: { label: "Opportuniteit", icon: "gem", fill: "#16291F", stroke: "#4FBF8B", glyph: "#BFF0D7" },
  saved: { label: "Eigen pin", icon: "bookmark", fill: "#2B1A0B", stroke: "#FF9A3C", glyph: "#FFD9AE" },
};

export const NEW_PIN_TYPES: MapPinType[] = ["saved", "contact", "company", "event", "opportunity", "side"];

export const TOWNS = [
  { n: "Heist-op-den-Berg", lat: 51.0764, lng: 4.7283 },
  { n: "Mechelen", lat: 51.0259, lng: 4.4776 },
  { n: "Aarschot", lat: 50.9861, lng: 4.8361 },
  { n: "Lier", lat: 51.1314, lng: 4.5706 },
  { n: "Geel", lat: 51.1656, lng: 4.9906 },
  { n: "Herentals", lat: 51.1758, lng: 4.8339 },
  { n: "Putte", lat: 51.05, lng: 4.6333 },
  { n: "Nijlen", lat: 51.1667, lng: 4.6667 },
  { n: "Herenthout", lat: 51.1333, lng: 4.75 },
  { n: "Berlaar", lat: 51.1167, lng: 4.65 },
  { n: "Westerlo", lat: 51.0897, lng: 4.9161 },
];

function pinTeardropPath(selected: boolean, meta: (typeof PIN_META)[MapPinType]) {
  return `<path d="M19 45C19 45 34 28.5 34 17A15 15 0 1 0 4 17C4 28.5 19 45 19 45Z"
      fill="${meta.fill}" stroke="${meta.stroke}" stroke-width="${selected ? 2.6 : 1.8}"/>`;
}

export function markerHtml(pin: Pick<MapPin, "type" | "state" | "iconSrc">, selected: boolean) {
  if (pin.iconSrc) {
    const meta = PIN_META[pin.type] ?? PIN_META.saved;
    const glow =
      pin.state === "active" || selected
        ? `<circle class="glow" cx="19" cy="16" r="17" fill="${meta.stroke}" opacity=".3"/>`
        : "";
    const done =
      pin.state === "completed"
        ? `<span class="mk-pin__done" style="--mk-stroke:${meta.stroke}"></span>`
        : "";
    const safeSrc = pin.iconSrc.replace(/"/g, "&quot;");
    const locked = pin.state === "locked";
    const blip = locked
      ? `<span class="mk-pin__blip mk-pin__blip--locked" aria-hidden="true"><span class="mk-pin__lock"></span></span>`
      : `<span class="mk-pin__blip" aria-hidden="true"><img src="${safeSrc}" alt="" decoding="async" loading="lazy" /></span>`;
    return `<div class="mk-pin mk-pin--blip${selected ? " is-sel" : ""}" style="--mk-fill:${meta.fill};--mk-stroke:${meta.stroke};--mk-glyph:${meta.glyph}">
      <svg viewBox="0 0 38 46" class="mk-pin__shape" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${glow}${pinTeardropPath(selected, meta)}</svg>
      ${blip}
      ${done}
    </div>`;
  }
  return markerSvg(pin, selected);
}

export function markerSvg(pin: Pick<MapPin, "type" | "state">, selected: boolean) {
  const meta = PIN_META[pin.type] ?? PIN_META.saved;
  const glow =
    pin.state === "active" || selected
      ? `<circle class="glow" cx="19" cy="16" r="17" fill="${meta.stroke}" opacity=".3"/>`
      : "";
  const lock = `<g transform="translate(13,10) scale(.55)" stroke="${meta.glyph}" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="${PATHS.lock}"/></g>`;
  const icon = `<g transform="translate(9,6) scale(.84)" stroke="${meta.glyph}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[meta.icon] ?? PATHS.target}"/></g>`;
  const done =
    pin.state === "completed"
      ? `<circle cx="30" cy="30" r="7" fill="#0B0907" stroke="${meta.stroke}" stroke-width="1.4"/><path d="M27 30l2 2 4-4.4" stroke="${meta.stroke}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      : "";
  return `<svg viewBox="0 0 38 46">${glow}
    <path d="M19 45C19 45 34 28.5 34 17A15 15 0 1 0 4 17C4 28.5 19 45 19 45Z"
      fill="${meta.fill}" stroke="${meta.stroke}" stroke-width="${selected ? 2.6 : 1.8}"/>
    ${pin.state === "locked" ? lock : icon}
    ${done}
  </svg>`;
}
