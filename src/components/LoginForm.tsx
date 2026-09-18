"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Aanmelden mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setError("Geen verbinding. Probeer het opnieuw.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-between px-4 pb-[calc(24px+var(--safe-b))] pt-10">
      <header>
        <p className="eyebrow">Kempen Vice</p>
        <h1 className="display mt-3 text-[34px] text-[var(--ivory)]">Empire Mode</h1>
        <p className="mt-3 max-w-[18rem] text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          Meld u aan. De sessie praat met de echte database.
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold tracking-[0.18em] text-[var(--ink-3)] uppercase">
            E-mail
          </span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-xl border border-[var(--line)] bg-[var(--charcoal)] px-3.5 text-[var(--ivory)]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-bold tracking-[0.18em] text-[var(--ink-3)] uppercase">
            Wachtwoord
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 rounded-xl border border-[var(--line)] bg-[var(--charcoal)] px-3.5 text-[var(--ivory)]"
          />
        </label>
        {error ? <p className="text-[13px] text-[var(--coral)]">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-12 rounded-xl bg-[image:var(--gold-grad)] text-[13px] font-extrabold tracking-[0.08em] text-[#1a1206] uppercase disabled:opacity-50"
        >
          {pending ? "Bezig…" : "Aanmelden"}
        </button>
      </form>
    </main>
  );
}
