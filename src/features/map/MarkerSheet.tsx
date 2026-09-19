"use client";

import Link from "next/link";
import { FileText, Navigation } from "lucide-react";
import { Plate } from "@/components/ui/Plate";
import { Tag } from "@/components/ui/Tag";
import { PIN_META } from "@/features/map/pinMeta";
import { firstSentence, missionPlate } from "@/lib/missions";
import { HOME_BASE, distanceKm, type HomeBase, type MapPin } from "@/server/domain/map/types";

export function MarkerSheet({
  pin,
  home,
  onNote,
  onDelete,
}: {
  pin: MapPin;
  home?: HomeBase | null;
  onNote: (title: string) => void;
  onDelete?: () => void;
}) {
  const meta = PIN_META[pin.type] ?? PIN_META.saved;
  const origin = home ?? HOME_BASE;
  const dist = distanceKm(origin, pin);
  const distLabel = home ? `${dist} km van Home Base` : `${dist} km van Heist (geen Home Base)`;
  const mission = pin.mission;
  const contact = pin.contact;

  if (mission) {
    return (
      <div className="sheet-body">
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <span style={{ width: 104, height: 104, flex: "0 0 auto", position: "relative" }}>
            <Plate
              kind={missionPlate(mission.kind)}
              className="fill"
              src={mission.coverSrc ?? undefined}
              approved={mission.coverApproved}
            />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="eyebrow" style={{ color: meta.stroke }}>
              {meta.label}
            </span>
            <h2 className="display d-lg" style={{ margin: "6px 0 4px" }}>
              {mission.title}
            </h2>
            <p className="meta" style={{ margin: "0 0 6px" }}>
              {mission.locationAddress || mission.locationName}
            </p>
            <p className="body" style={{ margin: 0, fontSize: 12.5 }}>
              {firstSentence(mission.why)}
            </p>
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 13 }}>
          <Tag className="alt">{mission.whenLabel || mission.estimateLabel || "—"}</Tag>
          <Tag className="alt">{`${mission.contactCount} contacten`}</Tag>
          <Tag>{`+${mission.xpReward} XP`}</Tag>
          <Tag className="alt">{distLabel}</Tag>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/missions/${mission.id}`} className="btn btn-gold" style={{ flex: "1 1 130px" }}>
            View mission
          </Link>
          <a
            className="btn btn-ghost"
            href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={14} strokeWidth={2.2} /> Route
          </a>
          <button className="btn btn-ghost" type="button" onClick={() => onNote(mission.title)}>
            <FileText size={14} strokeWidth={2.2} /> Add note
          </button>
        </div>
      </div>
    );
  }

  if (contact) {
    return (
      <div className="sheet-body">
        <span className="eyebrow" style={{ color: meta.stroke }}>
          {meta.label}
        </span>
        <h2 className="display d-lg" style={{ margin: "6px 0 4px" }}>
          {contact.name}
        </h2>
        <p className="body" style={{ margin: "0 0 8px" }}>
          {contact.address ? `${contact.address}` : null}
          {contact.address && (contact.role || contact.note) ? " — " : null}
          {contact.role}
          {contact.note ? ` — ${contact.note}` : ""}
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 13 }}>
          {contact.tier ? <Tag className="alt">{contact.tier}</Tag> : null}
          <Tag className="alt">{distLabel}</Tag>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-gold"
            style={{ flex: "1 1 130px" }}
            type="button"
            onClick={() => onNote(`Gesprek met ${contact.name}`)}
          >
            Notitie toevoegen
          </button>
          <a
            className="btn btn-ghost"
            href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={14} strokeWidth={2.2} /> Route
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-body">
      <span className="eyebrow" style={{ color: meta.stroke }}>
        {meta.label}
      </span>
      <h2 className="display d-lg" style={{ margin: "6px 0 4px" }}>
        {pin.title}
      </h2>
      {pin.note ? <p className="body" style={{ margin: "0 0 8px" }}>{pin.note}</p> : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 13 }}>
        <Tag className="alt">{`${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`}</Tag>
        <Tag className="alt">{distLabel}</Tag>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-gold" style={{ flex: "1 1 120px" }} type="button" onClick={() => onNote(pin.title)}>
          Notitie
        </button>
        <a
          className="btn btn-ghost"
          href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation size={14} strokeWidth={2.2} /> Route
        </a>
        {pin.custom && onDelete ? (
          <button className="btn btn-quiet" type="button" onClick={onDelete}>
            Verwijder
          </button>
        ) : null}
      </div>
    </div>
  );
}
