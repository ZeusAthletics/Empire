"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { EmpireValueChart } from "@/features/empire/EmpireValueChart";
import { useEmpireUI } from "@/components/empire-ui-context";
import { formatEuro, formatEuroDelta } from "@/lib/stats";
import { formatDateLabel } from "@/server/domain/journal/dates";
import type { EmpireValueState } from "@/server/domain/empire/repository";

export function EmpireValueScreen({ initial }: { initial: EmpireValueState }) {
  const router = useRouter();
  const { toast } = useEmpireUI();
  const [state, setState] = useState(initial);
  const [sign, setSign] = useState<"plus" | "min">("plus");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const parsed = Number(amount.replace(",", ".").replace(/[^\d.-]/g, ""));
  const abs = Number.isFinite(parsed) && parsed !== 0 ? Math.round(Math.abs(parsed)) : 0;
  const previewDelta = abs ? (sign === "min" ? -abs : abs) : 0;
  const previewTotal = state.current + previewDelta;
  const values = useMemo(
    () => (state.entries.length ? state.entries.map((entry) => entry.valueAfter) : [state.current]),
    [state.entries, state.current],
  );
  const latestDelta = [...state.entries].reverse().find((entry) => entry.delta !== 0)?.delta ?? 0;

  async function save() {
    if (!abs) {
      toast("Vul een bedrag in.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/empire-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: abs, sign, note }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string; state?: EmpireValueState };
      if (!response.ok || !data.ok || !data.state) {
        toast(data.error ?? "Empire value kon niet worden bijgewerkt.");
        return;
      }
      setState(data.state);
      setAmount("");
      setNote("");
      toast(sign === "min" ? "Empire value gedaald" : "Empire value gestegen");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="page-head" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/home" className="btn btn-ghost btn-icon" aria-label="Terug">
          <ArrowLeft size={18} strokeWidth={2.2} />
        </Link>
        <span className="eyebrow muted">Empire value</span>
      </header>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="card">
          <span className="eyebrow">Huidige waarde</span>
          <div className="display d-xl" style={{ margin: "8px 0 6px", fontSize: 36 }}>
            {formatEuro(state.current)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {latestDelta ? (
              <span
                style={{
                  color: latestDelta < 0 ? "var(--coral)" : "var(--jade)",
                  fontWeight: 800,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {latestDelta < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                {formatEuroDelta(latestDelta)}
              </span>
            ) : (
              <span className="meta">Nog geen beweging</span>
            )}
            {state.chapter ? (
              <span className="meta">
                Hoofdstuk {state.chapter.roman} · {formatEuro(state.from)} → {formatEuro(state.to)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <div className="card-head">
            <h2 className="display d-sm">Historiek</h2>
            <span className="eyebrow muted">{state.entries.length} punten</span>
          </div>
          <EmpireValueChart values={values} />
        </div>
      </div>

      <div className="section">
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2 className="display d-sm" style={{ margin: "0 0 12px" }}>
            Bijwerken
          </h2>
          <div className="field">
            <label>Richting</label>
            <div className="seg">
              <button type="button" className={sign === "plus" ? "is-on" : undefined} onClick={() => setSign("plus")}>
                Plus
              </button>
              <button type="button" className={sign === "min" ? "is-on" : undefined} onClick={() => setSign("min")}>
                Min
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="empireAmount">Bedrag</label>
            <input
              id="empireAmount"
              className="input"
              inputMode="numeric"
              placeholder="Bv. 2500"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="empireNote">Notitie (optioneel)</label>
            <input
              id="empireNote"
              className="input"
              placeholder="Bv. factuur Rita, of terugbetaling"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {abs ? (
            <p className="meta" style={{ margin: "0 0 12px" }}>
              {formatEuro(state.current)} {previewDelta < 0 ? "−" : "+"} {formatEuro(abs)} →{" "}
              <b style={{ color: previewTotal < state.current ? "var(--coral)" : "var(--jade)" }}>
                {formatEuro(previewTotal)}
              </b>
            </p>
          ) : null}
          <button className="btn btn-gold btn-block" type="submit" disabled={pending || !abs}>
            {pending ? "Bezig…" : sign === "min" ? "Waarde verlagen" : "Waarde verhogen"}
          </button>
        </form>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <div className="section-head">
          <h2 className="display d-sm">Bewegingen</h2>
        </div>
        {state.entries.length ? (
          <div className="stack">
            {[...state.entries].reverse().map((entry) => (
              <div key={entry.id} className="card flat" style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="meta" style={{ display: "block" }}>
                    {formatDateLabel(entry.at)}
                  </span>
                  <span style={{ fontSize: 13.5 }}>{entry.note ?? (entry.delta === 0 ? "Startpunt" : "Aanpassing")}</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  <b
                    style={{
                      display: "block",
                      color: entry.delta < 0 ? "var(--coral)" : entry.delta > 0 ? "var(--jade)" : "var(--ink-2)",
                      fontSize: 13.5,
                    }}
                  >
                    {entry.delta === 0 ? "—" : formatEuroDelta(entry.delta)}
                  </b>
                  <span className="meta">{formatEuro(entry.valueAfter)}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="body">Nog geen historiek. De eerste aanpassing zet het startpunt vast.</p>
        )}
      </div>
    </>
  );
}
