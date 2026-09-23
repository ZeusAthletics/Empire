"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  ChevronRight,
  Filter,
  Layers,
  List,
  Locate,
  MapPin as PinIcon,
  Minus,
  UserPlus,
  Plus,
  Search,
  Target,
  Users,
  Info,
} from "lucide-react";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { useEmpireUI } from "@/components/empire-ui-context";
import { MarkerSheet } from "@/features/map/MarkerSheet";
import { PIN_META, TOWNS, markerSvg } from "@/features/map/pinMeta";
import { PinComposer } from "@/features/map/PinComposer";
import type { MapHandle } from "@/features/map/MapCanvas";
import { HOME_BASE, filterPins, type MapFilter, type MapPin, type MapPinType, type MapState } from "@/server/domain/map/types";

const MapCanvas = dynamic(() => import("@/features/map/MapCanvas").then((mod) => mod.MapCanvas), { ssr: false });

const MAP_FILTERS = [
  { k: "all", label: "Alles", icon: Layers },
  { k: "missions", label: "Missies", icon: Target },
  { k: "contacts", label: "Contacten", icon: Users },
  { k: "companies", label: "Bedrijven", icon: Building2 },
  { k: "events", label: "Events", icon: Calendar },
  { k: "mine", label: "Mijn pins", icon: PinIcon },
] as const;

function scaleLabel(meters: number) {
  if (meters >= 1000) return `${meters / 1000} km`;
  return `${meters} m`;
}

export function MapScreen({
  state,
  focusMissionId,
  focusContactId,
}: {
  state: MapState;
  focusMissionId?: string;
  focusContactId?: string;
}) {
  const { openNyx, openSheet, closeSheet, toast } = useEmpireUI();
  const router = useRouter();
  const mapRef = useRef<MapHandle | null>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [scale, setScale] = useState({ label: "2 km", width: 74 });
  const [mapReady, setMapReady] = useState(false);
  const pins = useMemo(() => filterPins(state.pins, filter), [state.pins, filter]);
  const nearby = pins.filter((pin) => pin.kind === "mission").slice(0, 4);
  const focused = useRef(false);

  function selectPin(pin: MapPin, fly = false) {
    setSelectedId(pin.id);
    if (fly) mapRef.current?.flyTo(pin.lat, pin.lng, pin.type === "home" || pin.kind === "contact" ? 16 : 14);
    openSheet(
      pin.title,
      <MarkerSheet
        pin={pin}
        home={state.home}
        iconSets={state.iconSets}
        onNote={(title) => void saveMapNote(title, pin)}
        onDelete={pin.custom ? () => void removePin(pin.id) : undefined}
        onIconSaved={() => {
          closeSheet();
          router.refresh();
          toast("Kaarticoon opgeslagen");
        }}
      />,
    );
  }

  async function saveMapNote(title: string, pin: MapPin) {
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: pin.note ? `${title}. ${pin.note}` : title,
        locationName: pin.mission?.locationName ?? pin.title,
        missionId: pin.mission?.id,
        tags: ["MAP", "QUICK NOTE"],
      }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      toast(data.error ?? "Notitie kon niet worden bewaard.");
      return;
    }
    closeSheet();
    toast("Entry opgeslagen");
  }

  async function removePin(id: string) {
    const response = await fetch(`/api/map/pins/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      toast(data.error ?? "Pin kon niet worden verwijderd.");
      return;
    }
    closeSheet();
    toast("Pin verwijderd");
    router.refresh();
  }

  function openNewPin(ll: { lat: number; lng: number }, type: MapPinType = "saved") {
    openSheet(
      type === "contact" ? "Nieuw contact" : "Nieuwe pin",
      <PinComposer
        ll={ll}
        contacts={state.contactOptions}
        missions={state.missionOptions}
        defaultType={type}
        home={state.home}
        iconSets={state.iconSets}
        pending={false}
        onCancel={closeSheet}
        onSave={(input) => void savePin(ll, input)}
      />,
    );
  }

  async function savePin(
    ll: { lat: number; lng: number },
    input: {
      title: string;
      type: MapPinType;
      note: string;
      role?: string;
      address?: string;
      contactId?: string;
      missionId?: string;
      iconKey?: string | null;
    },
  ) {
    const response = await fetch("/api/map/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, lat: ll.lat, lng: ll.lng }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string; pin?: MapPin };
    if (!response.ok || !data.ok || !data.pin) {
      toast(data.error ?? "Pin kon niet worden bewaard.");
      return;
    }
    closeSheet();
    setFilter(data.pin.kind === "contact" ? "contacts" : "mine");
    setSelectedId(data.pin.id);
    toast(data.pin.kind === "contact" ? "Contact op de kaart" : "Pin opgeslagen");
    router.refresh();
    window.setTimeout(() => mapRef.current?.flyTo(data.pin!.lat, data.pin!.lng), 80);
  }

  function search() {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = state.pins.find((pin) => pin.title.toLowerCase().includes(q));
    if (hit) {
      selectPin(hit, true);
      return;
    }
    const town = TOWNS.find((item) => item.n.toLowerCase().includes(q));
    if (town) {
      mapRef.current?.flyTo(town.lat, town.lng, 13);
      return;
    }
    toast(`Niets gevonden voor “${query}”`);
  }

  function openNearby() {
    const list = nearby.length ? nearby : pins.slice(0, 8);
    openSheet(
      "Doelwitten",
      <NearbySheet
        pins={list}
        empty={!list.length}
        onPick={(pin) => selectPin(pin, true)}
        onAskNyx={openNyx}
      />,
    );
  }

  function openLegend() {
    openSheet("Legenda", <LegendSheet />);
  }

  useEffect(() => {
    if (focused.current || !mapReady) return;
    if (focusMissionId) {
      const pin = state.pins.find((item) => item.missionId === focusMissionId);
      if (pin) {
        focused.current = true;
        selectPin(pin, true);
      }
    } else if (focusContactId) {
      const pin = state.pins.find((item) => item.contactId === focusContactId);
      if (pin) {
        focused.current = true;
        selectPin(pin, true);
      }
    }
    // Focus from query once; selectPin would retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMissionId, focusContactId, state.pins, mapReady]);

  return (
    <>
      <header className="page-head" style={{ paddingBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 className="display d-md">
              Kempen <span style={{ color: "var(--gold)" }}>Vice</span>
            </h1>
            <span className="eyebrow muted">Real opportunities. No fiction.</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-pill)",
              background: "rgba(0,0,0,.35)",
            }}
          >
            <span style={{ color: "var(--ink-3)" }}>
              <Search size={16} strokeWidth={2} />
            </span>
            <input
              className="input"
              style={{ border: 0, background: "none", padding: "10px 0" }}
              placeholder="Zoek locatie, persoon, bedrijf…"
              aria-label="Zoek op de kaart"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") search();
              }}
            />
          </div>
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            aria-label="Doelwitten"
            onClick={openNearby}
          >
            <List size={18} strokeWidth={2} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            aria-label="Filters"
            onClick={() => toast("Gebruik de chips hieronder.")}
          >
            <Filter size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="chiprow" aria-label="Kaartfilters">
        {MAP_FILTERS.map((item) => (
          <button
            key={item.k}
            className="chip"
            type="button"
            aria-pressed={filter === item.k}
            onClick={() => setFilter(item.k)}
          >
            <item.icon size={14} strokeWidth={2} /> {item.label}
          </button>
        ))}
      </div>

      <div className="mapwrap" style={{ marginTop: 10 }}>
        <MapCanvas
          pins={pins}
          selectedId={selectedId}
          labels={labels}
          center={state.home ?? HOME_BASE}
          onReady={(handle) => {
            mapRef.current = handle;
            setMapReady(true);
          }}
          onSelect={(pin) => selectPin(pin)}
          onLongPress={openNewPin}
          onViewChange={(view) => {
            const targets = [100, 200, 500, 1000, 2000, 5000, 10000];
            let best = targets[0];
            for (const target of targets) {
              if (Math.abs(target / view.mpp - 74) < Math.abs(best / view.mpp - 74)) best = target;
            }
            setScale({ label: scaleLabel(best), width: Math.round(best / view.mpp) });
          }}
        />
        <div className="map-hint">Sleep om te pannen · lang indrukken = pin</div>
        <div className="map-ctl" style={{ top: 12 }}>
          <button
            className="map-btn"
            type="button"
            aria-label="Terug naar Home Base"
            onClick={() => {
              if (!state.home) {
                toast("Vul eerst uw adres in op Profiel.");
                return;
              }
              mapRef.current?.flyTo(state.home.lat, state.home.lng, 16);
              toast("Home Base");
            }}
          >
            <Locate size={18} strokeWidth={2} />
          </button>
          <button
            className="map-btn"
            type="button"
            aria-label="Kaartlaag wisselen"
            onClick={() => setLabels((value) => !value)}
          >
            <Layers size={18} strokeWidth={2} />
          </button>
          <button className="map-btn" type="button" aria-label="Legenda" onClick={openLegend}>
            <Info size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="map-ctl" style={{ top: 160 }}>
          <button className="map-btn" type="button" aria-label="Inzoomen" onClick={() => mapRef.current?.zoomBy(1)}>
            <Plus size={18} strokeWidth={2.2} />
          </button>
          <button className="map-btn" type="button" aria-label="Uitzoomen" onClick={() => mapRef.current?.zoomBy(-1)}>
            <Minus size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div className="map-dock">
          <div className="map-dock-meta">
            <div className="map-badge">{labels ? "Donkere basemap" : "Zonder labels"} · CARTO</div>
            <div className="map-scale">
              <span className="lab">{scale.label}</span>
              <div className="rule" style={{ width: scale.width }} />
            </div>
          </div>
          <div className="map-actions">
            <button
              className="btn btn-gold"
              type="button"
              onClick={() => openNewPin(mapRef.current?.getCenter() ?? state.home ?? HOME_BASE)}
            >
              <PinIcon size={15} strokeWidth={2.2} /> Eigen pin
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => openNewPin(mapRef.current?.getCenter() ?? state.home ?? HOME_BASE, "contact")}
            >
              <UserPlus size={15} strokeWidth={2.2} /> Contact
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function NearbySheet({
  pins,
  empty,
  onPick,
  onAskNyx,
}: {
  pins: MapPin[];
  empty: boolean;
  onPick: (pin: MapPin) => void;
  onAskNyx: () => void;
}) {
  return (
    <div className="sheet-body">
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2 className="display d-sm">Doelwitten in beeld</h2>
        <span className="eyebrow muted">{pins.length} markers</span>
      </div>
      <div className="stack">
        {empty ? (
          <EmptyInvite
            body="Nog geen pins in deze filter. Lang indrukken op de kaart zet een eigen pin vast."
            action={
              <button className="btn btn-ghost btn-sm" type="button" onClick={onAskNyx}>
                Vraag het aan Nyx
              </button>
            }
          />
        ) : (
          pins.map((pin) => {
            const meta = PIN_META[pin.type];
            return (
              <button
                key={pin.id}
                className="card flat tap"
                style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left" }}
                type="button"
                onClick={() => onPick(pin)}
              >
                <span
                  style={{ width: 34, height: 40, flex: "0 0 auto" }}
                  dangerouslySetInnerHTML={{ __html: markerSvg(pin, false) }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="eyebrow" style={{ color: meta.stroke }}>
                    {meta.label}
                  </span>
                  <span className="display d-sm" style={{ display: "block", margin: "3px 0" }}>
                    {pin.title}
                  </span>
                  <span className="meta">
                    {pin.mission ? `${pin.mission.locationName ?? ""} · +${pin.mission.xpReward} XP` : ""}
                  </span>
                </span>
                <span style={{ color: "var(--ink-3)" }}>
                  <ChevronRight size={16} strokeWidth={2.2} />
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function LegendSheet() {
  return (
    <div className="sheet-body">
      <h2 className="display d-sm" style={{ margin: "0 0 10px" }}>
        Legenda
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>
        {Object.entries(PIN_META).map(([key, meta]) => (
          <span key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--ink-2)" }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: meta.fill,
                border: `1.6px solid ${meta.stroke}`,
              }}
            />
            {meta.label}
          </span>
        ))}
      </div>
      <p className="meta" style={{ margin: "12px 0 0" }}>
        Status wordt ook zonder kleur aangeduid: voltooid krijgt een vinkje, vergrendeld een slot.
      </p>
    </div>
  );
}
