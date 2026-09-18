"use client";

/* Nyx portrait is a local raster from the prototype — next/image would fight the FAB CSS. */
/* eslint-disable @next/next/no-img-element */

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useEmpireUI } from "@/components/empire-ui-context";

export function NyxFab() {
  const { openNyx } = useEmpireUI();
  const pathname = usePathname();
  if (pathname === "/journal") return null;

  return (
    <button
      className="nyx-fab pulse"
      type="button"
      aria-label="Open Nyx — Mission Control"
      onClick={openNyx}
    >
      <img src="/nyx.jpg" alt="Nyx" />
      <span className="bubble" aria-hidden="true">
        <MessageCircle size={14} strokeWidth={2.2} />
      </span>
    </button>
  );
}
