import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function numbered(prefix: "welcome" | "listening", name: string) {
  const match = name.match(new RegExp(`^${prefix}(\\d+)\\.mp3$`, "i"));
  if (!match) return null;
  return { name, n: Number(match[1]) };
}

/** Lists welcomeN.mp3 / listeningN.mp3 from public/sounds — drop-in files auto-appear. */
export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "sounds");
    const entries = await readdir(dir).catch(() => [] as string[]);
    const welcome = entries
      .map((name) => numbered("welcome", name))
      .filter((row): row is { name: string; n: number } => Boolean(row))
      .sort((a, b) => a.n - b.n)
      .map((row) => `/sounds/${row.name}`);
    const listening = entries
      .map((name) => numbered("listening", name))
      .filter((row): row is { name: string; n: number } => Boolean(row))
      .sort((a, b) => a.n - b.n)
      .map((row) => `/sounds/${row.name}`);
    return NextResponse.json({ ok: true, welcome, listening });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sounds niet beschikbaar.";
    return NextResponse.json({ ok: false, error: message, welcome: [], listening: [] }, { status: 500 });
  }
}
