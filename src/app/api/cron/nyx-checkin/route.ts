import { NextResponse } from "next/server";
import { runNyxCheckInJob } from "@/server/ai/jobs/nyxCheckIn";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Niet gemachtigd." }, { status: 401 });
  }
  try {
    const result = await runNyxCheckInJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in job mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
