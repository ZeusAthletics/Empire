export const MIN_SILENCE_HOURS = 12;
export const MAX_CHECKINS_PER_WEEK = 3;
export const ROLLING_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type CheckInEligibilityInput = {
  nowMs: number;
  lastUserAtMs: number | null;
  silenceAnchorMs: number | null;
  lastCheckInAtMs: number | null;
  checkInsLast7Days: number;
  minSilenceHours?: number;
  maxPerWeek?: number;
};

export type CheckInEligibility = {
  ok: boolean;
  reason: string;
  hoursSilent: number;
  lastUserAtMs: number | null;
};

export function hoursBetween(fromMs: number, toMs: number): number {
  return Math.max(0, (toMs - fromMs) / (1000 * 60 * 60));
}

export function evaluateCheckInEligibility(input: CheckInEligibilityInput): CheckInEligibility {
  const minSilence = input.minSilenceHours ?? MIN_SILENCE_HOURS;
  const maxWeek = input.maxPerWeek ?? MAX_CHECKINS_PER_WEEK;

  const lastUserAtMs = input.lastUserAtMs;
  const anchorMs = lastUserAtMs ?? input.silenceAnchorMs ?? input.nowMs;
  const hoursSilent = hoursBetween(anchorMs, input.nowMs);

  if (hoursSilent < minSilence) {
    return {
      ok: false,
      reason: `Nog geen ${minSilence}u stilte (${hoursSilent.toFixed(1)}u).`,
      hoursSilent,
      lastUserAtMs,
    };
  }

  if (input.checkInsLast7Days >= maxWeek) {
    return {
      ok: false,
      reason: `Weeklimiet (${maxWeek}) bereikt.`,
      hoursSilent,
      lastUserAtMs,
    };
  }

  if (lastUserAtMs && input.lastCheckInAtMs && input.lastCheckInAtMs > lastUserAtMs) {
    return {
      ok: false,
      reason: "Check-in al gestuurd sinds laatste bericht van Hardwig.",
      hoursSilent,
      lastUserAtMs,
    };
  }

  return { ok: true, reason: "Eligible.", hoursSilent, lastUserAtMs };
}
