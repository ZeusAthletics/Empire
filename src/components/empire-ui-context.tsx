"use client";

import { createContext, useContext, type ReactNode } from "react";

export type EmpireUIValue = {
  openSheet: (label: string, content: ReactNode) => void;
  closeSheet: () => void;
  openNyx: () => void;
  toast: (message: string) => void;
};

export const EmpireUIContext = createContext<EmpireUIValue | null>(null);

export function useEmpireUI() {
  const ctx = useContext(EmpireUIContext);
  if (!ctx) throw new Error("useEmpireUI must be used inside EmpireUIProvider");
  return ctx;
}
