"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NyxGalleryItem } from "@/server/domain/nyx/galleryRepository";
import type { NyxIdentityRef } from "@/server/domain/nyx/identity/repository";
import {
  NYX_IMAGE_EDIT_MODEL_LABELS,
  NYX_IMAGE_EDIT_MODELS,
  type NyxImageEditModel,
} from "@/server/domain/nyx/identity/imageModel";
import { relTime } from "@/admin/format";

const ROLES = [
  { value: "FACE", label: "Face (verplicht voor foto's)" },
  { value: "BODY", label: "Body" },
  { value: "SIGNATURE_OUTFIT", label: "Signature outfit" },
  { value: "VARIANT_OK", label: "Variant OK" },
] as const;

export function NyxIdentityView({
  refs,
  gallery,
  facePrompt: initialFacePrompt,
  imageEditModel: initialImageEditModel,
}: {
  refs: NyxIdentityRef[];
  gallery: NyxGalleryItem[];
  facePrompt: string;
  imageEditModel: NyxImageEditModel;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("FACE");
  const [testNote, setTestNote] = useState<string | null>(null);
  const [facePrompt, setFacePrompt] = useState(initialFacePrompt);
  const [facePromptNote, setFacePromptNote] = useState<string | null>(null);
  const [imageEditModel, setImageEditModel] = useState<NyxImageEditModel>(initialImageEditModel);
  const [imageModelNote, setImageModelNote] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("role", role);
      const response = await fetch("/api/admin/nyx-identity", { method: "POST", body });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Upload mislukt.");
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function removeRef(id: string) {
    setPending(true);
    await fetch(`/api/admin/nyx-identity?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
    setPending(false);
  }

  async function removeGalleryItem(id: string) {
    if (!window.confirm("Verwijderen uit galerij en Nyx-chat? Dit kan niet ongedaan.")) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/nyx-gallery?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Galerij-item kon niet worden verwijderd.");
        return;
      }
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function saveFacePrompt() {
    setPending(true);
    setError(null);
    setFacePromptNote(null);
    try {
      const response = await fetch("/api/admin/nyx-identity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facePrompt }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; facePrompt?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Face prompt kon niet worden opgeslagen.");
        return;
      }
      if (typeof payload.facePrompt === "string") setFacePrompt(payload.facePrompt);
      setFacePromptNote("Face prompt opgeslagen — gebruikt bij elke identity-locked still.");
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  async function saveImageEditModel(next: NyxImageEditModel) {
    setImageEditModel(next);
    setPending(true);
    setError(null);
    setImageModelNote(null);
    try {
      const response = await fetch("/api/admin/nyx-identity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageEditModel: next }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        imageEditModel?: NyxImageEditModel;
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Model kon niet worden opgeslagen.");
        setImageEditModel(initialImageEditModel);
        return;
      }
      if (payload.imageEditModel) setImageEditModel(payload.imageEditModel);
      setImageModelNote(`Actief voor test + outreach: ${payload.imageEditModel ?? next}`);
    } catch {
      setError("Geen verbinding.");
      setImageEditModel(initialImageEditModel);
    } finally {
      setPending(false);
    }
  }

  async function forceTestPhoto() {
    setPending(true);
    setError(null);
    setTestNote(null);
    try {
      const response = await fetch("/api/admin/nyx-identity/test-photo", { method: "POST" });
      const payload = (await response.json()) as { ok: boolean; error?: string; messageId?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Testfoto mislukt.");
        return;
      }
      setTestNote("Verstuurd naar Hardwig — check Nyx-chat en Profiel → Galerij.");
      router.refresh();
    } catch {
      setError("Geen verbinding.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="head">
        <h1 className="display" style={{ fontSize: 22 }}>
          Nyx — identity vault
        </h1>
        <span className="muted">
          Face-ref + face prompt = identity lock · images.edit · niet de spelergalerij
        </span>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="eyebrow">Canon face prompt (tekst)</div>
        <p className="muted" style={{ margin: "8px 0 10px", fontSize: 12.5 }}>
          Plak hier je gedetailleerde gezichtsbeschrijving (leeftijd, ogen, neus, kaak, huid, haar, sieraden). Wordt
          samen met de Face-still naar het gekozen image model en de vision gate gestuurd.
        </p>
        <textarea
          className="input"
          rows={8}
          disabled={pending}
          value={facePrompt}
          onChange={(event) => setFacePrompt(event.target.value)}
          placeholder="Bijv. vrouw ~28, donkere hazel ogen, smalle neus, zachte kaaklijn, olijfachtige huid, zwart lang haar met gouden bliksemschicht-halsketting…"
          style={{ width: "100%", maxWidth: 720, resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
        />
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn gold sm" type="button" disabled={pending} onClick={() => void saveFacePrompt()}>
            {pending ? "Bezig…" : "Opslaan face prompt"}
          </button>
          {facePromptNote ? (
            <span className="muted" style={{ fontSize: 12, color: "var(--jade)" }}>
              {facePromptNote}
            </span>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <label className="field" style={{ display: "block", marginBottom: 12 }}>
          <span className="eyebrow">Rol van deze still</span>
          <select
            className="input"
            value={role}
            disabled={pending}
            onChange={(event) => setRole(event.target.value as (typeof ROLES)[number]["value"])}
            style={{ marginTop: 6, maxWidth: 360 }}
          >
            {ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={pending}
          style={{ display: "none" }}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />

        <div className="drop">
          <div className="eyebrow">Upload</div>
          <p className="muted" style={{ margin: "8px 0 12px" }}>
            6–12 stills: face close-up, 3/4, full body, gold latex + zwart leer.
          </p>
          <button
            className="btn gold sm"
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Bezig…" : "Kies afbeelding"}
          </button>
        </div>
        {error ? <p style={{ color: "var(--coral)", marginTop: 10 }}>{error}</p> : null}
        {testNote ? <p style={{ color: "var(--jade)", marginTop: 10 }}>{testNote}</p> : null}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="eyebrow">Image editor (test)</div>
        <p className="muted" style={{ margin: "8px 0 10px", fontSize: 12.5 }}>
          Kies welk OpenAI-model <code>images.edit</code> gebruikt voor Nyx-stills. Geldt voor force test én autonome
          outreach-foto&apos;s.
        </p>
        <label className="field" style={{ display: "block", maxWidth: 420 }}>
          <span className="eyebrow">Model</span>
          <select
            className="input"
            value={imageEditModel}
            disabled={pending}
            onChange={(event) => void saveImageEditModel(event.target.value as NyxImageEditModel)}
            style={{ marginTop: 6, width: "100%" }}
          >
            {NYX_IMAGE_EDIT_MODELS.map((value) => (
              <option key={value} value={value}>
                {NYX_IMAGE_EDIT_MODEL_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        {imageModelNote ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 12, color: "var(--jade)" }}>
            {imageModelNote}
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 8, fontSize: 11.5 }}>
            Huidige keuze: <span className="mono">{imageEditModel}</span>
          </p>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="eyebrow">Test outreach</div>
        <p className="muted" style={{ margin: "8px 0 12px", fontSize: 12.5 }}>
          Genereert één identity-locked still ({imageEditModel} + vision gate) en stuurt die naar de gescope speler. Telt
          niet mee als echte outreach-beslissing.
        </p>
        <button
          className="btn sm"
          type="button"
          disabled={pending || !refs.some((ref) => ref.role === "FACE")}
          onClick={() => void forceTestPhoto()}
        >
          {pending ? "Bezig…" : "Force test photo naar Hardwig"}
        </button>
        {!refs.some((ref) => ref.role === "FACE") ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 11.5 }}>
            Upload eerst minstens één Face-ref.
          </p>
        ) : null}
      </div>

      <div className="agrid" style={{ marginTop: 14 }}>
        {refs.map((ref) => (
          <article key={ref.id} className="acard">
            <div className="thumb">
              <img src={`/api/admin/nyx-identity/${ref.id}/file`} alt="" />
              <span className="badge up">{ref.role}</span>
            </div>
            <div className="ab">
              <div className="td-main">{ref.label ?? ref.role}</div>
              <div className="td-sub mono">{ref.storagePath.split("/").pop()}</div>
              <div style={{ marginTop: 10 }}>
                <button className="btn sm" type="button" disabled={pending} onClick={() => void removeRef(ref.id)}>
                  Verwijder
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!refs.length ? (
        <div className="empty" style={{ marginTop: 14 }}>
          Nog geen referenties. Upload minstens één <b>Face</b> voordat Nyx autonoom foto&apos;s mag sturen.
        </div>
      ) : null}

      <div className="head" style={{ marginTop: 28 }}>
        <h2 className="display" style={{ fontSize: 18 }}>
          Verstuurde beelden
        </h2>
        <span className="muted">Hardwig galerij + Nyx-chat · verwijderen wist ook de bijlage in het gesprek</span>
      </div>

      <div className="agrid" style={{ marginTop: 14 }}>
        {gallery.map((item) => (
          <article key={item.id} className="acard">
            <div className="thumb">
              {item.isVideo ? (
                <video src={item.src} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <img src={item.src} alt="" />
              )}
              <span className="badge up">{item.isVideo ? "VIDEO" : "FOTO"}</span>
            </div>
            <div className="ab">
              <div className="td-sub mono">{relTime(item.createdAt)}</div>
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn sm"
                  type="button"
                  disabled={pending}
                  style={{ color: "var(--coral)" }}
                  onClick={() => void removeGalleryItem(item.id)}
                >
                  Verwijder bij speler
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!gallery.length ? (
        <div className="empty" style={{ marginTop: 14 }}>
          Nog niets verstuurd naar Hardwig.
        </div>
      ) : null}
    </>
  );
}
