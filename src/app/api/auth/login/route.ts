import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findPlayerByAuthUserId } from "@/server/domain/player/repository";
import { afterLoginPath } from "@/server/auth/intakeGate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { ok: false, error: "Supabase is niet geconfigureerd. Vul .env.local in." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "E-mail en wachtwoord zijn verplicht." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: "Aanmelden mislukt. Controleer uw gegevens." }, { status: 401 });
  }

  const player = await findPlayerByAuthUserId(data.user.id).catch(() => null);
  return NextResponse.json({ ok: true, next: afterLoginPath(player) });
}
