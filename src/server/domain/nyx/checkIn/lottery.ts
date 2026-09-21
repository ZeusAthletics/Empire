import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

const BASE_DAY: Record<IntimacyTier, number> = {
  EARLY: 0.06,
  FRIEND: 0.1,
  TRUST: 0.14,
};

const BASE_NIGHT: Record<IntimacyTier, number> = {
  EARLY: 0.02,
  FRIEND: 0.035,
  TRUST: 0.05,
};

const SILENCE_BONUS_PER_12H = 0.02;
const MAX_SILENCE_BONUS = 0.08;

export function checkInSendProbability(input: {
  tier: IntimacyTier;
  hoursSilent: number;
  isDaytime: boolean;
}): number {
  const blocks = Math.floor(input.hoursSilent / 12);
  const bonus = Math.min(MAX_SILENCE_BONUS, blocks * SILENCE_BONUS_PER_12H);
  if (input.isDaytime) {
    return Math.min(0.35, BASE_DAY[input.tier] + bonus);
  }
  return BASE_NIGHT[input.tier];
}

export function rollCheckInLottery(input: {
  tier: IntimacyTier;
  hoursSilent: number;
  isDaytime: boolean;
  random: number;
}): boolean {
  const p = checkInSendProbability(input);
  return input.random < p;
}
