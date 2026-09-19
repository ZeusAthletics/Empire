export const INTERRUPTS_PER_DAY = 1;
export const INTERRUPTS_PER_WEEK = 3;

export type InterruptEvent = {
  at: string | Date;
  kind: string;
};

function startOfDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfIsoWeek(now: Date) {
  const day = startOfDay(now);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - (weekday - 1));
  return day;
}

export function summarizeBudget(events: InterruptEvent[], now = new Date()) {
  const dayStart = startOfDay(now).getTime();
  const weekStart = startOfIsoWeek(now).getTime();
  const usedToday = events.filter((event) => new Date(event.at).getTime() >= dayStart).length;
  const usedThisWeek = events.filter((event) => new Date(event.at).getTime() >= weekStart).length;
  return {
    usedToday,
    usedThisWeek,
    remainingToday: Math.max(0, INTERRUPTS_PER_DAY - usedToday),
    remainingWeek: Math.max(0, INTERRUPTS_PER_WEEK - usedThisWeek),
  };
}

export function canTakeInterrupt(events: InterruptEvent[], now = new Date()) {
  const budget = summarizeBudget(events, now);
  return budget.remainingToday > 0 && budget.remainingWeek > 0;
}
