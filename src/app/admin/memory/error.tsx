"use client";

export default function AdminMemoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card" style={{ borderColor: "rgba(240,82,82,.45)", maxWidth: 640 }}>
      <span className="eyebrow" style={{ color: "var(--coral)" }}>
        Memory inspector
      </span>
      <h1 className="display" style={{ fontSize: 20, marginTop: 8 }}>
        Pagina kon niet laden
      </h1>
      <p className="body" style={{ margin: "10px 0 14px", color: "var(--ink-2)" }}>
        {error.message || "Onbekende serverfout."}
      </p>
      <button className="btn gold sm" type="button" onClick={reset}>
        Opnieuw proberen
      </button>
    </div>
  );
}
