"use client";

/* Nyx portrait is a local raster from the prototype — next/image would fight the FAB CSS. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useEmpireUI } from "@/components/empire-ui-context";

export function NyxFab() {
  const { openNyx } = useEmpireUI();
  const pathname = usePathname();
  const [unreadMedia, setUnreadMedia] = useState(0);

  const refreshBadge = useCallback(async () => {
    try {
      const response = await fetch("/api/nyx/badge");
      if (!response.ok) return;
      const data = (await response.json()) as { ok?: boolean; unreadMedia?: number };
      if (typeof data.unreadMedia === "number") setUnreadMedia(data.unreadMedia);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void refreshBadge();
    const interval = window.setInterval(() => void refreshBadge(), 45_000);
    const onRefresh = () => void refreshBadge();
    window.addEventListener("nyx-badge-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("nyx-badge-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refreshBadge]);

  if (pathname === "/journal") return null;

  return (
    <button
      className="nyx-fab pulse"
      type="button"
      aria-label={
        unreadMedia > 0 ? `Open Nyx — ${unreadMedia} nieuw beeld` : "Open Nyx — Mission Control"
      }
      onClick={openNyx}
    >
      <img src="/nyx.jpg" alt="Nyx" />
      {unreadMedia > 0 ? (
        <span className="nyx-alert-dot" aria-hidden="true" title="Nieuwe foto of video van Nyx" />
      ) : null}
      <span className="bubble" aria-hidden="true">
        <MessageCircle size={14} strokeWidth={2.2} />
      </span>
    </button>
  );
}
