"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { EmpireUIContext } from "@/components/empire-ui-context";
import { NyxSheet } from "@/features/nyx/NyxSheet";

type CustomSheet = { label: string; content: ReactNode };

export function EmpireUIProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0.001 : 0.26;
  const [nyxOpen, setNyxOpen] = useState(false);
  const [custom, setCustom] = useState<CustomSheet | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastOn, setToastOn] = useState(false);

  const closeSheet = useCallback(() => {
    setNyxOpen(false);
    setCustom(null);
  }, []);

  const openSheet = useCallback((label: string, content: ReactNode) => {
    setNyxOpen(false);
    setCustom({ label, content });
  }, []);

  const openNyx = useCallback(() => {
    setCustom(null);
    setNyxOpen(true);
  }, []);

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    setToastOn(true);
    window.setTimeout(() => setToastOn(false), 2200);
  }, []);

  useEffect(() => {
    if (!nyxOpen && !custom) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet();
    }
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("sheet-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("sheet-open");
    };
  }, [nyxOpen, custom, closeSheet]);

  const value = useMemo(
    () => ({ openSheet, closeSheet, openNyx, toast }),
    [openSheet, closeSheet, openNyx, toast],
  );

  const sheetOpen = nyxOpen || custom !== null;
  const label = nyxOpen ? "Nyx mission control" : custom?.label ?? "Detailpaneel";

  return (
    <EmpireUIContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {sheetOpen ? (
          <>
            <motion.button
              key="scrim"
              type="button"
              className="scrim"
              aria-label="Sluiten"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration, ease: [0.2, 0.7, 0.3, 1] }}
              onClick={closeSheet}
            />
            <motion.div
              key="sheet"
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={label}
              initial={{ x: "-50%", y: "102%" }}
              animate={{ x: "-50%", y: 0 }}
              exit={{ x: "-50%", y: "102%" }}
              transition={{ duration, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <div className="sheet-head">
                <div className="grip" />
                <button type="button" className="sheet-close" aria-label="Sluiten" onClick={closeSheet}>
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>
              {nyxOpen ? <NyxSheet /> : custom?.content}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
      <div className={toastOn ? "toast show" : "toast"} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </EmpireUIContext.Provider>
  );
}
