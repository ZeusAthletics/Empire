/** Format chat rows for LLM prompts — includes what Nyx sent in photos/videos. */
export function formatChatLineForPrompt(row: {
  role: string;
  content: string;
  media_id?: string | null;
  media_context?: string | null;
}): string {
  const role = row.role === "USER" ? "USER" : "NYX";
  let line = `${role}: ${row.content}`;
  const ctx = row.media_context?.trim();
  if (row.role === "NYX" && ctx) {
    line += ` [Nyx stuurde beeld/video — wat u zag (Nyx weet dit, mag subtiel op voortbouwen): ${ctx}]`;
  } else if (row.role === "NYX" && row.media_id) {
    line += " [Nyx stuurde een bijlage zonder beschrijving in systeem]";
  }
  return line;
}
