import { isIntelligenceTask, type IntelligenceTask } from "@/server/ai/routing/IntelligenceTask";

const KEYWORDS: { task: IntelligenceTask; pattern: RegExp }[] = [
  { task: "MEMORY_EXTRACTION", pattern: /herinner|onthoud|memory/i },
  { task: "ENTITY_EXTRACTION", pattern: /entiteit|contactextract/i },
  { task: "JOURNAL_CLASSIFICATION", pattern: /classificeer.*journal|journal.*tag/i },
  { task: "CONTENT_FORMATTING", pattern: /formatteer|herschrijf kort|card copy/i },
  { task: "OPPORTUNITY_PREFILTER", pattern: /prefilter|ruwe kans/i },
  { task: "MAIN_QUEST_GENERATION", pattern: /main quest|hoofdopdracht/i },
  { task: "CHAPTER_PLANNING", pattern: /hoofdstuk|chapter/i },
  { task: "CAMPAIGN_REPLAN", pattern: /herplan|replan|campagne wijzigen/i },
  { task: "STRATEGIC_DECISION", pattern: /overname|acquisition|kapitaalallocatie/i },
  { task: "HIGH_IMPACT_SIDE_QUEST", pattern: /high[- ]impact side/i },
  { task: "SIDE_QUEST_GENERATION", pattern: /side quest|zijmissie/i },
  { task: "OPPORTUNITY_ANALYSIS", pattern: /opportunity|kans|event in /i },
  { task: "PERSONAL_REFLECTION", pattern: /reflectie|avond was/i },
];

export function classifyIntelligenceTask(input: { task?: string; text?: string }): IntelligenceTask {
  if (input.task && isIntelligenceTask(input.task)) return input.task;
  const text = input.text ?? "";
  for (const rule of KEYWORDS) {
    if (rule.pattern.test(text)) return rule.task;
  }
  return "CASUAL_CHAT";
}
