"use client";

import { useEffect } from "react";

function syncFrame() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--frame-h", `${Math.round(height)}px`);
}

export function PwaRegister() {
  useEffect(() => {
    syncFrame();
    const viewport = window.visualViewport;
    window.addEventListener("resize", syncFrame);
    viewport?.addEventListener("resize", syncFrame);
    viewport?.addEventListener("scroll", syncFrame);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    return () => {
      window.removeEventListener("resize", syncFrame);
      viewport?.removeEventListener("resize", syncFrame);
      viewport?.removeEventListener("scroll", syncFrame);
    };
  }, []);
  return null;
}
