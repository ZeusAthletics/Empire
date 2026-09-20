"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gem,
  ImageIcon,
  MapPin,
  Mic,
  MoreHorizontal,
  Send,
  Target,
  Users,
} from "lucide-react";
import { HeroArt } from "@/components/ui/HeroArt";
import { Plate } from "@/components/ui/Plate";
import { Tag } from "@/components/ui/Tag";
import { useEmpireUI } from "@/components/empire-ui-context";
import {
  JOURNAL_FILTERS,
  JOURNAL_ICONS,
  filterEntries,
  nextPlaceholderMedia,
} from "@/features/journal/journalMeta";
import { formatDateLabel, formatTime } from "@/server/domain/journal/dates";
import type { JournalEntry, JournalFilter, JournalMedia, JournalState } from "@/server/domain/journal/types";

export type JournalUpcoming = {
  id: string;
  when: string;
  title: string;
  detail: string;
};

function JournalCard({
  entry,
  onMenu,
}: {
  entry: JournalEntry;
  onMenu: (entry: JournalEntry) => void;
}) {
  const Icon = JOURNAL_ICONS[entry.icon] ?? JOURNAL_ICONS.edit;
  return (
    <article className="tl-item">
      <span className="tl-time">{formatTime(entry.at)}</span>
      <span className="tl-dot" />
      <div className="card flat">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span className="tl-ico">
            <Icon size={17} strokeWidth={1.9} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <b style={{ fontSize: 13.5 }}>{entry.title}</b>
              {entry.tags.map((tag) => (
                <Tag key={tag} className="alt">
                  {tag}
                </Tag>
              ))}
            </div>
            <p className="body" style={{ margin: "5px 0 0", fontSize: 12.5 }}>
              {entry.body}
            </p>
            {entry.contacts.length ? (
              <p className="meta" style={{ margin: "6px 0 0" }}>
                <Users size={11} strokeWidth={2} /> {entry.contacts.map((contact) => contact.name).join(", ")}
              </p>
            ) : null}
            {entry.locationName ? (
              <p className="meta" style={{ margin: "4px 0 0" }}>
                <MapPin size={11} strokeWidth={2} /> {entry.locationName}
              </p>
            ) : null}
            {entry.missionId && entry.missionTitle ? (
              <Link className="meta" style={{ marginTop: 6, color: "var(--gold)", display: "inline-flex", gap: 4 }} href={`/missions/${entry.missionId}`}>
                <Target size={11} strokeWidth={2} /> {entry.missionTitle}
              </Link>
            ) : null}
          </div>
          <button
            className="btn btn-icon"
            style={{ minHeight: 32, width: 32, color: "var(--ink-3)" }}
            type="button"
            aria-label="Opties"
            onClick={() => onMenu(entry)}
          >
            <MoreHorizontal size={16} strokeWidth={2.6} />
          </button>
        </div>
        {entry.media.length ? (
          <div className="media-row">
            {entry.media.slice(0, 3).map((item, index) => (
              <Plate
                key={`${item.kind}-${index}`}
                kind={item.kind}
                label={item.label}
                src={item.src}
                approved={item.approved}
              />
            ))}
            {entry.extraMedia ? <span className="media-more">+{entry.extraMedia}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function JournalScreen({
  initial,
  upcoming,
  opportunityCount,
}: {
  initial: JournalState;
  upcoming: JournalUpcoming[];
  opportunityCount: number;
}) {
  const router = useRouter();
  const { toast, openSheet, closeSheet } = useEmpireUI();
  const [entries, setEntries] = useState(initial.entries);
  const [monthCount, setMonthCount] = useState(initial.monthEntryCount);
  const [filter, setFilter] = useState<JournalFilter>("today");
  const [dayOffset, setDayOffset] = useState(0);
  const [pendingMedia, setPendingMedia] = useState<JournalMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEntries(initial.entries);
    setMonthCount(initial.monthEntryCount);
  }, [initial.entries, initial.monthEntryCount]);

  const viewed = new Date();
  viewed.setDate(viewed.getDate() + dayOffset);
  const list = filterEntries(entries, filter, viewed);

  function resizeNote() {
    const ta = noteRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 92)}px`;
  }

  async function saveNote() {
    const text = noteRef.current?.value.trim() ?? "";
    if (!text) {
      toast("Schrijf eerst iets — ook één zin telt.");
      noteRef.current?.focus();
      return;
    }
    setSaving(true);
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, media: pendingMedia }),
    });
    const data = (await response.json()) as { ok: boolean; entry?: JournalEntry; error?: string };
    setSaving(false);
    if (!response.ok || !data.ok || !data.entry) {
      toast(data.error ?? "Notitie kon niet worden bewaard.");
      return;
    }
    if (noteRef.current) {
      noteRef.current.value = "";
      noteRef.current.style.height = "auto";
    }
    setPendingMedia([]);
    setFilter("today");
    setDayOffset(0);
    setEntries((current) => [data.entry!, ...current]);
    setMonthCount((count) => count + 1);
    toast("Entry opgeslagen");
    router.refresh();
    requestAnimationFrame(() => document.querySelector(".tl-item")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  async function createWrap() {
    const response = await fetch("/api/journal/wrap", { method: "POST" });
    const data = (await response.json()) as { ok: boolean; wrap?: { id: string }; error?: string };
    if (!response.ok || !data.ok || !data.wrap) {
      toast(data.error ?? "Wrap kon niet worden gemaakt.");
      return;
    }
    toast("Wrap gegenereerd");
    router.push(`/journal/wrap/${data.wrap.id}`);
    router.refresh();
  }

  function openEntryMenu(entry: JournalEntry) {
    openSheet(
      "Entry-opties",
      <div className="sheet-body">
        <h2 className="display d-md" style={{ margin: "0 0 12px" }}>
          Entry
        </h2>
        <div className="stack">
          <button
            className="card flat tap"
            style={{ textAlign: "left" }}
            type="button"
            onClick={() => {
              closeSheet();
              toast("Bewerken volgt later.");
            }}
          >
            Bewerken (binnenkort)
          </button>
          <button
            className="card flat tap"
            style={{ textAlign: "left", color: "var(--coral)" }}
            type="button"
            onClick={() => void removeEntry(entry.id)}
          >
            Verwijderen
          </button>
        </div>
      </div>,
    );
  }

  async function removeEntry(id: string) {
    const response = await fetch(`/api/journal/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      toast(data.error ?? "Entry kon niet worden verwijderd.");
      return;
    }
    setEntries((current) => current.filter((entry) => entry.id !== id));
    closeSheet();
    toast("Entry verwijderd");
    router.refresh();
  }

  return (
    <>
      <header className="hero" style={{ paddingBottom: 14 }}>
        <HeroArt seed={3} />
        <div className="hero-corner">
          <span className="eyebrow">Discipline turns moments into outcomes</span>
        </div>
        <h1 className="display d-xl" style={{ margin: "16px 0 4px" }}>
          Journal
        </h1>
        <span className="eyebrow muted">Capture today. Build tomorrow.</span>
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 16px 0" }}>
        <div className="chiprow" style={{ padding: 0, flex: 1 }} aria-label="Periode">
          {JOURNAL_FILTERS.map((item) => (
            <button
              key={item.key}
              className="chip"
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 0" }}>
        <span className="card flat" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
          <span style={{ color: "var(--gold)" }}>
            <Calendar size={15} strokeWidth={2} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{formatDateLabel(viewed)}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
            <button
              className="btn btn-icon"
              style={{ minHeight: 32, width: 30, color: "var(--ink-3)" }}
              type="button"
              aria-label="Vorige dag"
              onClick={() => {
                setDayOffset((value) => value - 1);
                setFilter("today");
              }}
            >
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            <button
              className="btn btn-icon"
              style={{ minHeight: 32, width: 30, color: "var(--ink-3)" }}
              type="button"
              aria-label="Volgende dag"
              onClick={() => {
                setDayOffset((value) => value + 1);
                setFilter("today");
              }}
            >
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </span>
        </span>
      </div>

      <div className="section grid-2">
        <div className="card flat" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-caveat), Caveat, cursive",
              fontSize: 19,
              lineHeight: 1.25,
              color: "var(--ivory)",
            }}
          >
            “Schrijf wat er bewoog. Ik bouw daar later een patroon van.”
          </p>
          <span className="script" style={{ marginTop: 6, textAlign: "right" }}>
            Nyx
          </span>
        </div>
        <button
          className="btn btn-gold"
          style={{ height: "100%", flexDirection: "column", gap: 4, padding: "14px 10px" }}
          type="button"
          onClick={() => void createWrap()}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <BarChart3 size={16} strokeWidth={2.2} /> Maak wrap
          </span>
          <span style={{ fontSize: 9, letterSpacing: "0.14em", opacity: 0.8 }}>Deze maand · {monthCount} notities</span>
        </button>
      </div>

      <div className="section">
        <div className="tl">
          {list.length ? (
            list.map((entry) => <JournalCard key={entry.id} entry={entry} onMenu={openEntryMenu} />)
          ) : (
            <div className="card flat" style={{ textAlign: "center", padding: "24px 16px" }}>
              <p className="body" style={{ margin: 0 }}>
                Nog niets gelogd voor deze periode. Schrijf hieronder wat er vandaag echt bewoog.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="section grid-2">
        <div className="card">
          <div className="card-head">
            <span className="t eyebrow">
              <BarChart3 size={13} strokeWidth={2} /> Vandaag
            </span>
          </div>
          <div className="stack" style={{ gap: 9 }}>
            {[
              [FileText, list.length, "Notities"],
              [Users, list.filter((entry) => entry.contacts.length).length, "Gesprekken"],
              [Gem, opportunityCount, "Kansen"],
            ].map(([Icon, value, label]) => {
              const StatIcon = Icon as typeof FileText;
              return (
                <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ color: "var(--gold)" }}>
                    <StatIcon size={15} strokeWidth={2} />
                  </span>
                  <b style={{ fontSize: 13 }}>{value as number}</b>
                  <span className="meta">{label as string}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="t eyebrow">
              <Calendar size={13} strokeWidth={2} /> Gepland
            </span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {upcoming.length ? (
              upcoming.map((item) => (
                <Link key={item.id} href={`/missions/${item.id}`} style={{ display: "flex", gap: 9 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--gold)",
                      marginTop: 6,
                      flex: "0 0 auto",
                    }}
                  />
                  <span>
                    <span className="meta" style={{ display: "block" }}>
                      {item.when}
                    </span>
                    <b style={{ fontSize: 12.5 }}>{item.title}</b>
                    {item.detail ? (
                      <span className="meta" style={{ display: "block" }}>
                        {item.detail}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))
            ) : (
              <p className="body" style={{ margin: 0 }}>
                Nog geen geplande missies.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="section" style={{ textAlign: "center", margin: "18px 0 92px" }}>
        <span className="script" style={{ fontSize: 24 }}>
          Kempen Vice
        </span>
        <p className="eyebrow muted" style={{ margin: "2px 0 0" }}>
          Real opportunities. No fiction.
        </p>
      </div>

      <div className="composer">
        <button
          className="ic"
          type="button"
          aria-label="Beeld toevoegen"
          onClick={() => {
            const next = nextPlaceholderMedia(pendingMedia.length);
            setPendingMedia((current) => [...current, next]);
            toast(`${pendingMedia.length + 1} beeld${pendingMedia.length ? "en" : ""} gekoppeld aan deze notitie`);
          }}
        >
          <ImageIcon size={19} strokeWidth={1.9} />
        </button>
        <textarea
          ref={noteRef}
          rows={1}
          placeholder="Wat bewoog er vandaag?"
          aria-label="Quick note"
          onInput={resizeNote}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void saveNote();
            }
          }}
        />
        <button
          className="ic"
          type="button"
          aria-label="Spraaknotitie"
          onClick={() => toast("Spraaknotities komen later — typ hier voorlopig")}
        >
          <Mic size={19} strokeWidth={1.9} />
        </button>
        <button className="send" type="button" aria-label="Notitie opslaan" disabled={saving} onClick={() => void saveNote()}>
          <Send size={18} strokeWidth={2.1} />
        </button>
      </div>
    </>
  );
}
