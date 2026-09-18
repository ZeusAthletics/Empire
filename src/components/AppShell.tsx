"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { EmpireUIProvider } from "@/components/EmpireUI";
import { NyxFab } from "@/components/NyxFab";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <EmpireUIProvider>
      <div className="app">
        <main className="view" tabIndex={-1}>
          {children}
        </main>
      </div>
      <NyxFab />
      <BottomNav />
    </EmpireUIProvider>
  );
}
