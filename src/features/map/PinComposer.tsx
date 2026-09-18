"use client";

import { useState } from "react";
import { PIN_META, NEW_PIN_TYPES } from "@/features/map/pinMeta";
import { HOME_BASE, distanceKm, type MapOption, type MapPinType } from "@/server/domain/map/types";

export function PinComposer({
  ll,
  contacts,
  missions,
  pending,
  onCancel,
  onSave,
}: {
  ll: { lat: number; lng: number };
  contacts: MapOption[];
  missions: MapOption[];
  pending?: boolean;
  onCancel: () => void;
  onSave: (input: {
    title: string;
    type: MapPinType;
    note: string;
    contactId?: string;
    missionId?: string;
  }) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MapPinType>("saved");
  const [note, setNote] = useState("");
  const [contactId, setContactId] = useState("");
  const [missionId, setMissionId] = useState("");
  const [busy, setBusy] = useState(false);
  const dist = distanceKm(HOME_BASE, ll);

  return (
    <>
      <div className="sheet-body">
        <h2 className="display d-md" style={{ margin: "0 0 3px" }}>
          Nieuwe pin
        </h2>
        <p className="meta" style={{ margin: "0 0 14px" }}>
          {ll.lat.toFixed(5)}, {ll.lng.toFixed(5)} · {dist} km van Home Base
        </p>
        <div className="field">
          <label htmlFor="pinTitle">Titel</label>
          <input
            id="pinTitle"
            className="input"
            placeholder="Bv. Locatie bezocht met Kevin"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Type pin</label>
          <div className="seg">
            {NEW_PIN_TYPES.map((item) => (
              <button
                key={item}
                type="button"
                className={type === item ? "is-on" : undefined}
                onClick={() => setType(item)}
              >
                {PIN_META[item].label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="pinNote">Notitie (optioneel)</label>
          <textarea
            id="pinNote"
            className="input"
            placeholder="Wat maakt deze plek relevant?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pinContact">Contact koppelen</label>
            <select id="pinContact" className="input" value={contactId} onChange={(event) => setContactId(event.target.value)}>
              <option value="">—</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pinMission">Missie koppelen</label>
            <select id="pinMission" className="input" value={missionId} onChange={(event) => setMissionId(event.target.value)}>
              <option value="">—</option>
              {missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="sheet-foot" style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-quiet" type="button" onClick={onCancel}>
          Annuleer
        </button>
        <button
          className="btn btn-gold"
          style={{ flex: 1 }}
          type="button"
          disabled={busy || pending}
          onClick={() => {
            setBusy(true);
            Promise.resolve(
              onSave({
                title,
                type,
                note,
                contactId: contactId || undefined,
                missionId: missionId || undefined,
              }),
            ).finally(() => setBusy(false));
          }}
        >
          Save pin
        </button>
      </div>
    </>
  );
}
