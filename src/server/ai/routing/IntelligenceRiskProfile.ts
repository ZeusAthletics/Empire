export type IntelligenceRiskProfile = {
  complexity: number;
  strategicImpact: number;
  uncertainty: number;
  irreversibility: number;
  campaignChanging?: boolean;
};

const ZERO: IntelligenceRiskProfile = {
  complexity: 0,
  strategicImpact: 0,
  uncertainty: 0,
  irreversibility: 0,
};

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeRiskProfile(partial?: Partial<IntelligenceRiskProfile>): IntelligenceRiskProfile {
  return {
    complexity: clamp01(partial?.complexity ?? ZERO.complexity),
    strategicImpact: clamp01(partial?.strategicImpact ?? ZERO.strategicImpact),
    uncertainty: clamp01(partial?.uncertainty ?? ZERO.uncertainty),
    irreversibility: clamp01(partial?.irreversibility ?? ZERO.irreversibility),
    campaignChanging: Boolean(partial?.campaignChanging),
  };
}
