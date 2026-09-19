import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  Crown,
  Gem,
  Infinity as InfinityIcon,
  Users,
} from "lucide-react";
import type { StatKey } from "@/server/domain/player/types";

export const STAT_META: Record<
  StatKey,
  { label: string; icon: LucideIcon; tone?: "coral" }
> = {
  capital: { label: "CAPITAL", icon: Gem },
  income: { label: "INCOME", icon: BarChart3 },
  ownership: { label: "OWNERSHIP", icon: Building2 },
  network: { label: "NETWORK", icon: Users },
  authority: { label: "AUTHORITY", icon: Crown },
  strategy: { label: "STRATEGY", icon: Brain },
  execution: { label: "EXECUTION", icon: CheckCircle2 },
  optionality: { label: "OPTIONALITY", icon: InfinityIcon, tone: "coral" },
};

export const CORE_STAT_KEYS: StatKey[] = ["network", "authority", "optionality"];

export function formatXp(n: number) {
  return n.toLocaleString("nl-BE");
}

export function formatEuro(n: number) {
  return `€${n.toLocaleString("nl-BE")}`;
}

export function formatEuroDelta(n: number) {
  if (n === 0) return formatEuro(0);
  const sign = n > 0 ? "+" : "−";
  return `${sign}${formatEuro(Math.abs(n))}`;
}
