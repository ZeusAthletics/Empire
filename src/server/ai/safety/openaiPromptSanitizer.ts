import type { NyxContext } from "@/server/ai/context/NyxContextBuilder";

/** Shown to OpenAI instead of raw intimate/explicit chat or memory text. */
export const OPENAI_INTIMATE_REDACT_PLACEHOLDER =
  "[Gemaskeerd: intiem/expliciet moment tussen Hardwig en Nyx — geen details in deze prompt; ga verder in normale companion-toon.]";

export const OPENAI_CLASSIFY_REDACT_PLACEHOLDER =
  "[Spelerbericht bevat intieme/expliciete taal — label alleen intent (intimate/exitSignal); reproduceer de tekst niet.]";

const EXPLICIT_CONTENT =
  /\b(seks|sex|geil|nat|hard|klaarkomen|klaar\s*komen|neuken|neuk|orgasme|orgasm|cum|lick|zuigen|pijpen|vinger|kont|borsten|tepels|naakt|naked|horny|aroused|wet\s+for|fuck\s+me|make\s+love|liefdesdaad|intiem|intimate|erotisch|erotic|dirty\s+talk|rolplay|roleplay|ondeugend|naughty|opgewonden|geil\s+maak|trek\s+me|kom\s+in\s+me|lik\s+me|neuk|fuck|cum|klaarkom|pijp|zuig|kontgat|kut|pik|lul|penis|vagina|sperma|dick|pussy|anal|blowjob|handjob|nude|nudes|strip|dominant|submissive|bondage|bdsm)\b/i;

export function containsExplicitContent(text: string): boolean {
  return EXPLICIT_CONTENT.test(text);
}

export function redactExplicitText(text: string, placeholder = OPENAI_INTIMATE_REDACT_PLACEHOLDER): string {
  if (!text.trim()) return text;
  if (!containsExplicitContent(text)) return text;
  return placeholder;
}

/** USER:/NYX: lines from chat history. */
export function redactChatLineForOpenAI(line: string): string {
  const match = line.match(/^((?:USER|NYX):\s*)([\s\S]*)$/i);
  if (!match) return containsExplicitContent(line) ? redactExplicitText(line) : line;
  const [, prefix, body] = match;
  if (!containsExplicitContent(body)) return line;
  return `${prefix}${OPENAI_INTIMATE_REDACT_PLACEHOLDER}`;
}

export function redactChatLinesForOpenAI(lines: string[]): string[] {
  return lines.map(redactChatLineForOpenAI);
}

export function sanitizeNyxContextForOpenAI(context: NyxContext): NyxContext {
  const mapLine = (line: string) =>
    containsExplicitContent(line) ? redactExplicitText(line) : line;

  return {
    ...context,
    relevantMemories: context.relevantMemories.map(mapLine),
    relevantJournalEntries: context.relevantJournalEntries.map(mapLine),
    openPatterns: context.openPatterns.map(mapLine),
    liveOpportunities: context.liveOpportunities.map(mapLine),
    relationshipDirection: context.relationshipDirection
      ? mapLine(context.relationshipDirection)
      : null,
    playerModelSummary: context.playerModelSummary
      ? mapLine(context.playerModelSummary)
      : null,
  };
}

export function sanitizePersonaCoreForOpenAI(core: string): string {
  if (!containsExplicitContent(core)) return core;
  return core
    .split(/\n\n+/)
    .map((paragraph) =>
      containsExplicitContent(paragraph) ? OPENAI_INTIMATE_REDACT_PLACEHOLDER : paragraph,
    )
    .join("\n\n");
}

/**
 * Masks explicit segments in task payloads (recent chat blocks, recap transcripts, player turns).
 */
export function sanitizeOpenAITaskText(task: string, text: string): string {
  if (!text.trim()) return text;

  if (task === "INTIMATE_CLASSIFY") {
    const marker = "Spelerbeurt:\n";
    const idx = text.indexOf(marker);
    if (idx === -1) return sanitizeFreeformOpenAIText(text);
    const head = text.slice(0, idx + marker.length);
    const turn = text.slice(idx + marker.length);
    const safeTurn = containsExplicitContent(turn)
      ? OPENAI_CLASSIFY_REDACT_PLACEHOLDER
      : turn;
    return head + safeTurn;
  }

  if (task === "INTIMATE_RECAP") {
    const marker = "Transcript (intern):\n";
    const idx = text.indexOf(marker);
    if (idx === -1) return sanitizeFreeformOpenAIText(text);
    const head = text.slice(0, idx + marker.length);
    const body = text.slice(idx + marker.length);
    const lines = body.split("\n");
    const safeLines = redactChatLinesForOpenAI(lines);
    const note =
      safeLines.some((l, i) => l !== lines[i])
        ? "Sommige beurten zijn gemaskeerd (intiem tussen Hardwig en Nyx).\n"
        : "";
    return head + note + safeLines.join("\n");
  }

  return sanitizeFreeformOpenAIText(text);
}

function sanitizeFreeformOpenAIText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (/^(USER|NYX):/i.test(line.trim())) return redactChatLineForOpenAI(line);
      if (containsExplicitContent(line)) return redactExplicitText(line);
      return line;
    })
    .join("\n");
}
