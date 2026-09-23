"use client";

import { useState } from "react";
import { IconPicker } from "@/features/map/IconPicker";
import { PIN_META, NEW_PIN_TYPES } from "@/features/map/pinMeta";
import { HOME_BASE, distanceKm, type HomeBase, type MapIconSetSummary, type MapOption, type MapPinType } from "@/server/domain/map/types";

export function PinComposer({
  ll,
  contacts,
  missions,
  pending,
  defaultType = "saved",
  home,
  iconSets,
  onCancel,
  onSave,
}: {
  ll: { lat: number; lng: number };
  contacts: MapOption[];
  missions: MapOption[];
  pending?: boolean;
  defaultType?: MapPinType;
  home?: HomeBase | null;
  iconSets: MapIconSetSummary[];
  onCancel: () => void;
  onSave: (input: {
    title: string;
    type: MapPinType;
    note: string;
    role?: string;
    address?: string;
    contactId?: string;
    missionId?: string;
    iconKey?: string | null;
  }) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MapPinType>(defaultType);
  const [note, setNote] = useState("");
  const [role, setRole] = useState("");
  const [address, setAddress] = useState("");
  const [contactId, setContactId] = useState("");
  const [missionId, setMissionId] = useState("");
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dist = distanceKm(home ?? HOME_BASE, ll);
  const asContact = type === "contact";

  return (
    <>
      <div className="sheet-body">
        <h2 className="display d-md" style={{ margin: "0 0 3px" }}>
          {asContact ? "Nieuw contact" : "Nieuwe pin"}
        </h2>
        <p className="meta" style={{ margin: "0 0 14px" }}>
          {ll.lat.toFixed(5)}, {ll.lng.toFixed(5)} · {dist} km van Home Base
        </p>
        <div className="field">
          <label htmlFor="pinTitle">{asContact ? "Naam" : "Titel"}</label>
          <input
            id="pinTitle"
            className="input"
            placeholder={asContact ? "Bv. Kevin" : "Bv. Locatie bezocht met Kevin"}
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
        {asContact ? (
          <>
            <div className="field">
              <label htmlFor="pinRole">Rol (optioneel)</label>
              <input
                id="pinRole"
                className="input"
                placeholder="Bv. maker · partner"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pinAddress">Adres (optioneel als u op de kaart tikt)</label>
              <input
                id="pinAddress"
                className="input"
                placeholder="Bv. Bergstraat 12, Heist-op-den-Berg"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
          </>
        ) : null}
        <div className="field">
          <label htmlFor="pinNote">Notitie (optioneel)</label>
          <textarea
            id="pinNote"
            className="input"
            placeholder={asContact ? "Waarom telt deze persoon?" : "Wat maakt deze plek relevant?"}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        {asContact ? null : (
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
        )}
        {iconSets.length ? (
          <div className="field">
            <label>Kaarticoon (optioneel)</label>
            <IconPicker sets={iconSets} value={iconKey} disabled={busy || pending} onChange={setIconKey} />
          </div>
        ) : null}
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
                role: role || undefined,
                address: address || undefined,
                contactId: contactId || undefined,
                missionId: missionId || undefined,
                iconKey,
              }),
            ).finally(() => setBusy(false));
          }}
        >
          {asContact ? "Bewaar contact" : "Save pin"}
        </button>
      </div>
    </>
  );
}
