"use client";

import { useState } from "react";

export function ContactComposer({
  pending,
  onSave,
}: {
  pending?: boolean;
  onSave: (input: { name: string; role: string; place: string; note: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        Promise.resolve(onSave({ name, role, place, note }))
          .then(() => {
            setName("");
            setRole("");
            setPlace("");
            setNote("");
          })
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    >
      <div className="field">
        <label htmlFor="contactName">Naam</label>
        <input
          id="contactName"
          className="input"
          placeholder="Bv. Kevin"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
        />
      </div>
      <div className="field">
        <label htmlFor="contactRole">Rol (optioneel)</label>
        <input
          id="contactRole"
          className="input"
          placeholder="Bv. maker · partner"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="contactPlace">Adres</label>
        <input
          id="contactPlace"
          className="input"
          placeholder="Bv. Bergstraat 12, Heist-op-den-Berg"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="contactNote">Notitie (optioneel)</label>
        <textarea
          id="contactNote"
          className="input"
          placeholder="Waarom telt deze persoon?"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <button className="btn btn-gold btn-block" type="submit" disabled={busy || pending}>
        {busy || pending ? "Bezig…" : "Contact toevoegen"}
      </button>
    </form>
  );
}
