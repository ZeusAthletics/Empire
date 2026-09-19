"use client";

import { useState } from "react";
import Link from "next/link";
import { Home } from "lucide-react";

export function HomeAddressForm({
  address,
  pending,
  onSave,
}: {
  address: string | null;
  pending?: boolean;
  onSave: (address: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(address ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        Promise.resolve(onSave(value))
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    >
      <div className="field">
        <label htmlFor="homeAddress">Straat, nummer, gemeente</label>
        <input
          id="homeAddress"
          className="input"
          placeholder="Bv. Bergstraat 12, Heist-op-den-Berg"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
      </div>
      {address ? (
        <p className="meta" style={{ margin: "0 0 10px" }}>
          <Home size={12} strokeWidth={2.2} /> {address} ·{" "}
          <Link href="/map">toon op de kaart</Link>
        </p>
      ) : (
        <p className="meta" style={{ margin: "0 0 10px" }}>
          Zonder dit adres staat er geen Home Base-icoon op de kaart.
        </p>
      )}
      <button className="btn btn-gold btn-block" type="submit" disabled={busy || pending}>
        {busy || pending ? "Bezig…" : address ? "Adres bijwerken" : "Home Base zetten"}
      </button>
    </form>
  );
}
