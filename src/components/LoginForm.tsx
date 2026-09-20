"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
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
      const payload = (await response.json()) as { ok: boolean; error?: string; next?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Aanmelden mislukt.");
        return;
      }
      window.location.assign(payload.next ?? "/intake");
    } catch {
      setError("Geen verbinding. Probeer het opnieuw.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="view">
      <header className="hero" style={{ paddingBottom: 8 }}>
        <p className="eyebrow">Kempen Vice</p>
        <h1 className="display d-xl" style={{ margin: "12px 0 8px" }}>
          Empire Mode
        </h1>
        <p className="body" style={{ maxWidth: "18rem", margin: 0 }}>
          Meld u aan. De sessie praat met de echte database.
        </p>
      </header>

      <form onSubmit={onSubmit} className="section" style={{ marginTop: 28 }}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Wachtwoord</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <p className="body" style={{ color: "var(--coral)", margin: "0 0 12px" }}>{error}</p> : null}
        <button className="btn btn-gold btn-block" type="submit" disabled={pending}>
          {pending ? "Bezig…" : "Aanmelden"}
        </button>
      </form>
    </main>
  );
}
