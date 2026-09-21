export type NyxHistoryMessage = {
  id: string;
  role: "USER" | "NYX" | "SYSTEM";
  content: string;
  createdAt: string;
};

export type NyxChatTurn = {
  userMessageId: string;
  userText: string;
  nyxText: string;
  createdAt: string;
};

const MIN_USER_CHARS = 12;

/** Chronological USER → following NYX lines (SYSTEM skipped). */
export function pairNyxChatTurns(messages: NyxHistoryMessage[]): NyxChatTurn[] {
  const turns: NyxChatTurn[] = [];
  let i = 0;
  while (i < messages.length) {
    const row = messages[i];
    if (row.role !== "USER") {
      i += 1;
      continue;
    }
    const userText = row.content.trim();
    i += 1;
    const nyxParts: string[] = [];
    while (i < messages.length && messages[i].role === "NYX") {
      nyxParts.push(messages[i].content.trim());
      i += 1;
    }
    if (userText.length < MIN_USER_CHARS) continue;
    turns.push({
      userMessageId: row.id,
      userText,
      nyxText: nyxParts.join("\n").trim() || "(geen Nyx-antwoord in log)",
      createdAt: row.createdAt,
    });
  }
  return turns;
}
