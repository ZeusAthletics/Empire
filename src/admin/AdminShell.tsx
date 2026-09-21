"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const NAV: { href: string; label: string; exact?: boolean; key?: string }[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/proposals", label: "Proposals", key: "proposals" },
  { href: "/admin/memory", label: "Memory" },
  { href: "/admin/patterns", label: "Patterns" },
  { href: "/admin/radar", label: "Opportunity radar" },
  { href: "/admin/campaign", label: "Campaign" },
  { href: "/admin/runs", label: "AI runs" },
  { href: "/admin/prompts", label: "Prompts" },
  { href: "/admin/persona", label: "Nyx — persona" },
  { href: "/admin/nyx-identity", label: "Nyx — identity" },
  { href: "/admin/nyx-gallery", label: "Nyx — galerij" },
  { href: "/admin/nyx-relationship", label: "Nyx — relatie" },
  { href: "/admin/assets", label: "Beeldmateriaal" },
];

function crumbFor(pathname: string) {
  const match = [...NAV].reverse().find((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)));
  return match?.label ?? "Overview";
}

export function AdminShell({
  children,
  pending,
  operatorName,
  scopedName,
  scopedId,
}: {
  children: ReactNode;
  pending: number;
  operatorName: string;
  scopedName: string;
  scopedId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="ops">
      <div className="layout">
        <aside className="side">
          <div className="brand">
            <div className="n">Empire Mode</div>
            <div className="s">Operations</div>
          </div>
          <nav aria-label="Admin-navigatie">
            {NAV.map((item) => {
              const current = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const count = "key" in item && item.key === "proposals" ? pending : "";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="navlink"
                  aria-current={current ? "page" : undefined}
                >
                  <span>{item.label}</span>
                  {count !== "" ? <span className={`c ${pending > 0 ? "hot" : ""}`}>{count}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="foot">
            <div className="eyebrow">Ingelogd als</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--line-gold)",
                  color: "var(--gold)",
                  fontWeight: 800,
                  flex: "0 0 auto",
                }}
              >
                EO
              </span>
              <span className="full">
                <b style={{ fontSize: 12, display: "block" }}>{operatorName}</b>
                <span className="mono muted">role: ADMIN</span>
              </span>
            </div>
            <button className="btn sm" style={{ marginTop: 10, width: "100%" }} type="button" onClick={logout}>
              Afmelden
            </button>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <span className="crumb">
              Operations <span className="muted">/</span> <b>{crumbFor(pathname)}</b>
            </span>
            <span className="env">{process.env.NODE_ENV === "production" ? "live" : "staging"}</span>
            <span className="scope">
              <span className="dot" />
              Speler: <b>{scopedName}</b>
              <span className="muted mono">{scopedId.slice(0, 8)}</span>
            </span>
          </header>
          <div className="content">{children}</div>
        </div>
      </div>
    </div>
  );
}
