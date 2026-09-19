"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, Check, ChevronDown, ChevronRight, MapPin, Star, Trash2, Users } from "lucide-react";
import { Bar } from "@/components/ui/Bar";
import { EmptyInvite } from "@/components/ui/EmptyInvite";
import { HeroArt } from "@/components/ui/HeroArt";
import { Plate } from "@/components/ui/Plate";
import { Tag } from "@/components/ui/Tag";
import { useEmpireUI } from "@/components/empire-ui-context";
import { ContactComposer } from "@/features/contacts/ContactComposer";
import { HomeAddressForm } from "@/features/profile/HomeAddressForm";
import { STAT_META, formatXp } from "@/lib/stats";
import type { PublicContact } from "@/server/domain/contact/repository";
import type { PublicCampaign } from "@/server/domain/campaign/types";
import type { MonthlyWrap } from "@/server/domain/journal/types";
import type { PublicPlayer } from "@/server/domain/player/types";

export function ProfileScreen({
  player,
  campaign,
  wraps,
  contacts,
}: {
  player: PublicPlayer;
  campaign: PublicCampaign | null;
  wraps: MonthlyWrap[];
  contacts: PublicContact[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [openContacts, setOpenContacts] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { toast } = useEmpireUI();

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function addContact(input: { name: string; role: string; place: string; note: string }) {
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        role: input.role,
        note: input.note,
        address: input.place,
      }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string; contact?: PublicContact };
    if (!response.ok || !data.ok) {
      const message = data.error ?? "Contact kon niet worden bewaard.";
      toast(message);
      throw new Error(message);
    }
    toast(data.contact?.lat != null ? "Contact op de kaart" : "Contact bewaard");
    router.refresh();
  }

  async function deleteContact(id: string) {
    const response = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      toast(data.error ?? "Contact kon niet worden verwijderd.");
      return;
    }
    setConfirmId(null);
    toast("Contact verwijderd");
    router.refresh();
  }

  async function saveHome(address: string) {
    const response = await fetch("/api/me/home", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      const message = data.error ?? "Home Base kon niet worden bewaard.";
      toast(message);
      throw new Error(message);
    }
    toast("Home Base staat op de kaart");
    router.refresh();
  }

  return (
    <>
      <header className="hero" style={{ paddingBottom: 20 }}>
        <HeroArt seed={5} />
        <div className="hero-corner">
          <span className="eyebrow">Discipline creates freedom</span>
        </div>
        <span className="eyebrow" style={{ display: "block", lineHeight: 1.7 }}>
          Hardwig
          <br />
          Empire mode
        </span>
        <h1 className="display d-xl" style={{ margin: "26px 0 2px" }}>
          {player.displayName}
        </h1>
        <div className="display d-md" style={{ color: "var(--gold)" }}>
          Level {player.level}
        </div>
        <div className="eyebrow muted" style={{ marginTop: 4 }}>
          {player.title}
        </div>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: "var(--font-caveat), Caveat, cursive",
            fontSize: 22,
            lineHeight: 1.25,
            maxWidth: 230,
          }}
        >
          “A better man builds a brighter Belgium.”
        </p>
      </header>

      <div className="section grid-2" style={{ marginTop: 0 }}>
        <div className="card" style={{ textAlign: "left" }}>
          <span style={{ color: "var(--gold)" }}>
            <BookOpen size={18} strokeWidth={1.9} />
          </span>
          <span className="eyebrow muted" style={{ display: "block", marginTop: 8 }}>
            Current chapter
          </span>
          <span className="display d-md" style={{ display: "block", margin: "4px 0" }}>
            {campaign?.chapter?.name ?? "Nog niet geladen"}
          </span>
          <span className="meta">
            {campaign?.chapter?.tagline ?? "Hoofdstuk volgt wanneer de campagne live is."}
          </span>
        </div>
        <div className="card" style={{ textAlign: "left" }}>
          <span style={{ color: "var(--gold)" }}>
            <Star size={18} strokeWidth={1.9} />
          </span>
          <span className="eyebrow muted" style={{ display: "block", marginTop: 8 }}>
            Lifetime XP
          </span>
          <span className="display d-md" style={{ display: "block", margin: "4px 0" }}>
            {formatXp(player.lifetimeXp)} XP
          </span>
          <span className="meta">Experience builds options</span>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <div className="card-head">
            <h2 className="display d-sm">Core stats</h2>
            <span className="eyebrow muted">Improve today</span>
          </div>
          {player.stats.map((stat) => {
            const meta = STAT_META[stat.key];
            const Icon = meta.icon;
            return (
              <div key={stat.key} className="statrow">
                <span style={{ color: "var(--gold)" }}>
                  <Icon size={15} strokeWidth={2} />
                </span>
                <span className="nm">{meta.label}</span>
                <Bar pct={stat.value} className={meta.tone === "coral" ? "coral thin" : "thin"} />
                <span className="vl">
                  {stat.value} <small>/ 100</small>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Home Base</h2>
          <span className="eyebrow muted">{player.homeAddress ? "Op de kaart" : "Nog geen adres"}</span>
        </div>
        <HomeAddressForm address={player.homeAddress} pending={pending} onSave={(value) => void saveHome(value)} />
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Campaign metrics</h2>
          <span className="eyebrow muted">Small steps compound</span>
        </div>
        <EmptyInvite body="Geen campagnemetriek tot missies en netwerk in de database staan." />
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Contacten</h2>
          <span className="eyebrow muted">{contacts.length} zichtbaar</span>
        </div>
        <button
          className="card tap"
          type="button"
          onClick={() => setOpenContacts((open) => !open)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
        >
          <span>
            <span className="display d-sm" style={{ display: "block" }}>
              {openContacts ? "Verberg contacten" : "Bekijk contacten"}
            </span>
            <span className="meta">{contacts.length ? "Lijst en toevoegen" : "Nog leeg · voeg er een toe"}</span>
          </span>
          {openContacts ? <ChevronDown size={18} strokeWidth={2.2} /> : <ChevronRight size={18} strokeWidth={2.2} />}
        </button>
        {openContacts ? (
          <div style={{ marginTop: 12 }}>
            {contacts.length ? (
              <div className="stack" style={{ marginBottom: 12 }}>
                {contacts.map((contact) => (
                  <div key={contact.id} className="card flat" style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid var(--line)",
                        color: "var(--gold)",
                        fontWeight: 800,
                        flex: "0 0 auto",
                      }}
                    >
                      {contact.name[0]}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 13.5 }}>{contact.name}</b>
                      <span className="meta" style={{ display: "block" }}>
                        {contact.address ?? contact.role ?? "Geen adres"}
                        {contact.address && contact.role ? ` · ${contact.role}` : ""}
                        {contact.lat != null ? " · op de kaart" : ""}
                      </span>
                    </span>
                    {contact.lat != null ? (
                      <Link href={`/map?contact=${contact.id}`} className="btn btn-quiet btn-sm">
                        <MapPin size={13} strokeWidth={2.2} /> Kaart
                      </Link>
                    ) : null}
                    {confirmId === contact.id ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        style={{ color: "var(--coral)" }}
                        disabled={pending}
                        onClick={() => void deleteContact(contact.id)}
                      >
                        Zeker?
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-icon"
                        type="button"
                        aria-label={`Verwijder ${contact.name}`}
                        onClick={() => setConfirmId(contact.id)}
                      >
                        <Trash2 size={15} strokeWidth={2.1} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyInvite body="Nog geen contacten. Voeg er een toe, of zet een pin van het type Contact op de kaart." />
            )}
            <ContactComposer pending={pending} onSave={(input) => void addContact(input)} />
          </div>
        ) : null}
      </div>

      <div className="section">
        <div className="section-head">
          <h2 className="display d-sm">Campaign highlights</h2>
          <span className="eyebrow muted">Momenten stapelen</span>
        </div>
        {wraps.length ? (
          <div className="stack">
            {wraps.map((wrap) => (
              <Link key={wrap.id} href={`/journal/wrap/${wrap.id}`} className="card tap" style={{ padding: 0, overflow: "hidden", textAlign: "left" }}>
                <span style={{ display: "block", height: 76, position: "relative" }}>
                  <Plate kind="city" className="fill" />
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, transparent, rgba(11, 9, 7, 0.92))",
                    }}
                  />
                  <span className="display d-md" style={{ position: "absolute", left: 13, bottom: 9 }}>
                    {wrap.label}
                  </span>
                </span>
                <span style={{ display: "block", padding: "11px 13px" }}>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", fontSize: 11.5, color: "var(--ink-2)" }}>
                    <span>
                      <Calendar size={12} strokeWidth={2} /> {wrap.events} events
                    </span>
                    <span>
                      <Users size={12} strokeWidth={2} /> {wrap.newContacts} nieuwe contacten
                    </span>
                    <span>
                      <Check size={12} strokeWidth={2} /> {wrap.missionsCompleted} missies
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
                    <span style={{ display: "flex", gap: 6 }}>
                      {Object.entries(wrap.deltas)
                        .slice(0, 2)
                        .map(([key, value]) => (
                          <Tag key={key} className="alt">
                            {`${key} +${value}`}
                          </Tag>
                        ))}
                    </span>
                    <span className="btn btn-ghost btn-sm">
                      View wrap <ChevronRight size={13} strokeWidth={2.4} />
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyInvite body="Nog geen monthly wrap. Maak er een in Journal." />
        )}
      </div>

      <div className="section" style={{ marginBottom: 14 }}>
        <div className="card flat">
          <span className="eyebrow muted">Sessie</span>
          <p className="body" style={{ margin: "6px 0 10px" }}>
            Deze sessie komt uit Supabase Auth. Stats komen uit Postgres. Vernieuw of zet de app op de achtergrond: u blijft binnen.
          </p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => void logout()} disabled={pending}>
            {pending ? "Bezig…" : "Afmelden"}
          </button>
        </div>
      </div>
    </>
  );
}
