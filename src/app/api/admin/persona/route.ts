import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { getActivePersona, saveActivePersona } from "@/server/domain/persona/repository";
import { compilePersona, DEFAULT_PERSONA } from "@/server/ai/prompts/persona";

export const runtime = "nodejs";

export async function GET() {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Niet gemachtigd." }, { status: 401 });
  try {
    const active = await getActivePersona();
    return NextResponse.json({
      ok: true,
      persona: active,
      fallback: compilePersona(DEFAULT_PERSONA),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Persona kon niet worden geladen.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Niet gemachtigd." }, { status: 401 });

  let body: { compiledPrompt?: string; address?: string };
  try {
    body = (await request.json()) as { compiledPrompt?: string; address?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  try {
    const persona = await saveActivePersona({
      compiledPrompt: body.compiledPrompt ?? "",
      address: body.address === "je" ? "je" : "u",
    });
    return NextResponse.json({ ok: true, persona });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opslaan mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
