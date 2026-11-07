/** Pull complete spoken sentences from a growing LLM buffer for early TTS. */

const BOUNDARY = /(?<=[.!?…])(?:\s+|$)/;

export function pullReadySentences(
  buffer: string,
  opts: { final?: boolean; softFlushChars?: number } = {},
): { sentences: string[]; rest: string } {
  const softFlushChars = opts.softFlushChars ?? 110;
  const trimmedStart = buffer.replace(/^\s+/, "");
  if (!trimmedStart) return { sentences: [], rest: "" };

  if (opts.final) {
    const last = trimmedStart.trim();
    return { sentences: last ? [last] : [], rest: "" };
  }

  const parts = trimmedStart.split(BOUNDARY);
  if (parts.length <= 1) {
    // No terminator yet — soft-flush long clauses so TTS can start.
    if (trimmedStart.length >= softFlushChars) {
      const soft = trimmedStart.match(/^([\s\S]{40,}?[,;:—–-])\s+([\s\S]*)$/);
      if (soft?.[1]) {
        return { sentences: [soft[1].trim()], rest: soft[2] ?? "" };
      }
    }
    return { sentences: [], rest: trimmedStart };
  }

  const rest = parts.pop() ?? "";
  const sentences = parts.map((part) => part.trim()).filter(Boolean);
  return { sentences, rest };
}
