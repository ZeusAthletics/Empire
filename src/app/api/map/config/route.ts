import { NextResponse } from "next/server";

export const runtime = "nodejs";

function tileUrls() {
  const key = process.env.CARTO_API_KEY || process.env.NEXT_PUBLIC_CARTO_API_KEY || process.env.CARTO_KEY || "";
  const query = key ? `?key=${encodeURIComponent(key)}` : "";
  return {
    keyed: Boolean(key),
    all: `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${query}`,
    plain: `https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png${query}`,
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, tiles: tileUrls() });
}
