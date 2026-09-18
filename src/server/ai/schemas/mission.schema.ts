export type MainQuestStrategy = {
  primaryBottleneck: string;
  strategicReason: string;
  currentState: Record<string, unknown>;
  desiredTransition: Record<string, unknown>;
  dependencies: string[];
  mainObjective: string;
  objectives: string[];
  optionalObjectives: string[];
  successCriteria: string[];
  evidenceRequirements: string[];
  targetStats: string[];
  risks: string[];
  expectedImpact: Record<string, unknown>;
  recommendedDifficulty: string;
  confidence: number;
};
