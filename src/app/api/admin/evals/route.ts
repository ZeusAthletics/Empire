import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { runGoldens } from "@/server/ai/evals/goldens";

export const runtime = "nodejs";

export async function GET() {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Niet gemachtigd." }, { status: 401 });
  const suite = runGoldens();
  return NextResponse.json({ ok: suite.passed === suite.total, ...suite });
}
