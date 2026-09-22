"use client";

/* eslint-disable @next/next/no-img-element */

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { NyxGalleryItem } from "@/server/domain/nyx/galleryRepository";

export function NyxGallerySection({ items }: { items: NyxGalleryItem[] }) {
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState<NyxGalleryItem | null>(null);

  return (
    <div className="section">
      <div className="section-head">
        <h2 className="display d-sm">Galerij</h2>
        <span className="eyebrow muted">{items.length ? "Van Nyx" : "Nog leeg"}</span>
      </div>
      <button
        className="card tap"
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
      >
        <span>
          <span className="display d-sm" style={{ display: "block" }}>
            {open ? "Verberg galerij" : "Bekijk galerij"}
          </span>
          <span className="meta">{items.length ? `${items.length} beeld(en)` : "Nog niets van Nyx."}</span>
        </span>
        {open ? <ChevronDown size={18} strokeWidth={2.2} /> : <ChevronRight size={18} strokeWidth={2.2} />}
      </button>
      {open ? (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {items.length ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="card tap"
                style={{ padding: 0, overflow: "hidden", aspectRatio: "1", position: "relative" }}
                onClick={() => setLightbox(item)}
              >
                {item.isVideo ? (
                  <video
                    src={item.src}
                    muted
                    playsInline
                    preload="metadata"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <img src={item.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </button>
            ))
          ) : (
            <p className="muted" style={{ gridColumn: "1 / -1" }}>
              Nog niets van Nyx.
            </p>
          )}
        </div>
      ) : null}
      {lightbox ? (
        <div
          role="presentation"
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(8,6,4,.92)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          {lightbox.isVideo ? (
            <video
              src={lightbox.src}
              controls
              playsInline
              preload="auto"
              style={{ maxWidth: "100%", maxHeight: "85vh" }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <img src={lightbox.src} alt="" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12 }} />
          )}
        </div>
      ) : null}
    </div>
  );
}
