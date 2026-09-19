"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { markerSvg } from "@/features/map/pinMeta";
import { HOME_BASE, type MapPin } from "@/server/domain/map/types";

type CartoTiles = { all: string; plain: string };

function fallbackTiles(): CartoTiles {
  const key = process.env.NEXT_PUBLIC_CARTO_API_KEY;
  const query = key ? `?key=${encodeURIComponent(key)}` : "";
  return {
    all: `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${query}`,
    plain: `https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png${query}`,
  };
}

async function loadTiles(): Promise<CartoTiles> {
  try {
    const response = await fetch("/api/map/config", { cache: "no-store" });
    const data = (await response.json()) as { ok?: boolean; tiles?: CartoTiles };
    if (response.ok && data.tiles?.all) return data.tiles;
  } catch {
    /* use fallback */
  }
  return fallbackTiles();
}

export type MapHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  zoomBy: (delta: number) => void;
  getCenter: () => { lat: number; lng: number };
};

export function MapCanvas({
  pins,
  selectedId,
  labels,
  center,
  onSelect,
  onLongPress,
  onViewChange,
  onReady,
}: {
  pins: MapPin[];
  selectedId: string | null;
  labels: boolean;
  center?: { lat: number; lng: number };
  onSelect: (pin: MapPin) => void;
  onLongPress: (ll: { lat: number; lng: number }) => void;
  onViewChange?: (view: { mpp: number }) => void;
  onReady?: (handle: MapHandle) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const urlsRef = useRef<CartoTiles>(fallbackTiles());
  const onSelectRef = useRef(onSelect);
  const onLongPressRef = useRef(onLongPress);
  const onViewRef = useRef(onViewChange);
  const onReadyRef = useRef(onReady);
  onSelectRef.current = onSelect;
  onLongPressRef.current = onLongPress;
  onViewRef.current = onViewChange;
  onReadyRef.current = onReady;

  useEffect(() => {
    const el = hostRef.current;
    if (!el || mapRef.current) return;
    let cancelled = false;

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 9.5,
      maxZoom: 18,
    }).setView([center?.lat ?? HOME_BASE.lat, center?.lng ?? HOME_BASE.lng], center ? 15 : 11.2);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    L.DomUtil.create("div", "map-film", map.getContainer());
    L.DomUtil.create("div", "map-film-2", map.getContainer());
    L.DomUtil.create("div", "map-vignette", map.getContainer());

    void loadTiles().then((urls) => {
      if (cancelled || !mapRef.current) return;
      urlsRef.current = urls;
      tilesRef.current?.remove();
      tilesRef.current = L.tileLayer(urls.all, { maxZoom: 20, subdomains: "abcd" }).addTo(map);
    });

    const handle: MapHandle = {
      flyTo(lat, lng, zoom) {
        map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.6 });
      },
      zoomBy(delta) {
        map.setZoom(Math.max(9.5, Math.min(18, map.getZoom() + delta)));
      },
      getCenter() {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng };
      },
    };
    onReadyRef.current?.(handle);

    let lpTimer: number | null = null;
    let start: { x: number; y: number } | null = null;
    const cancel = () => {
      if (lpTimer) window.clearTimeout(lpTimer);
      lpTimer = null;
    };
    const down = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".mk") || target.closest(".map-ctl") || target.closest(".map-btn")) return;
      start = { x: event.clientX, y: event.clientY };
      cancel();
      lpTimer = window.setTimeout(() => {
        if (!start) return;
        const ll = map.mouseEventToLatLng({ clientX: start.x, clientY: start.y } as MouseEvent);
        if (navigator.vibrate) navigator.vibrate(12);
        onLongPressRef.current({ lat: ll.lat, lng: ll.lng });
      }, 550);
    };
    const move = (event: PointerEvent) => {
      if (!start) return;
      if (Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 8) cancel();
    };
    const up = () => {
      start = null;
      cancel();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    map.on("contextmenu", (event: L.LeafletMouseEvent) => {
      event.originalEvent.preventDefault();
      onLongPressRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    const updateView = () => {
      const c = map.getCenter();
      const zoom = map.getZoom();
      const mpp = (156543.03392 * Math.cos((c.lat * Math.PI) / 180)) / Math.pow(2, zoom);
      onViewRef.current?.({ mpp });
    };
    map.on("moveend", updateView);
    map.on("zoomend", updateView);
    updateView();

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      cancelled = true;
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      ro.disconnect();
      cancel();
      map.remove();
      mapRef.current = null;
      tilesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  const labelsReady = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!labelsReady.current) {
      labelsReady.current = true;
      return;
    }
    tilesRef.current?.remove();
    tilesRef.current = L.tileLayer(labels ? urlsRef.current.all : urlsRef.current.plain, {
      maxZoom: 20,
      subdomains: "abcd",
    }).addTo(map);
  }, [labels]);

  useEffect(() => {
    const group = markersRef.current;
    if (!group) return;
    group.clearLayers();
    for (const pin of pins) {
      const selected = pin.id === selectedId;
      const icon = L.divIcon({
        className: `mk${selected ? " sel" : ""}${pin.state === "completed" ? " done" : ""}${pin.state === "locked" ? " locked" : ""}`,
        html: markerSvg(pin, selected),
        iconSize: [38, 44],
        iconAnchor: [19, 44],
      });
      const marker = L.marker([pin.lat, pin.lng], { icon, keyboard: true, title: pin.title });
      marker.on("click", () => onSelectRef.current(pin));
      marker.addTo(group);
    }
  }, [pins, selectedId]);

  return <div ref={hostRef} className="leaflet-host" />;
}
