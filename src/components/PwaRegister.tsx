"use client";

import { useEffect } from "react";

function syncFrame() {
  const layoutH = window.innerHeight;
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty("--frame-h", `${layoutH}px`);
    return;
  }
  // Full-screen frame uses layout viewport (content under status bar). Only shrink when the keyboard is open.
  const keyboardOpen = vv.height < layoutH * 0.75;
  const height = keyboardOpen ? Math.round(vv.height + vv.offsetTop) : layoutH;
  document.documentElement.style.setProperty("--frame-h", `${height}px`);
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
