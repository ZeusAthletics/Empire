import { analyzeChatAttachment, formatAttachmentBlock } from "@/server/ai/services/NyxAttachmentAnalysis";
import { getPlayerChatAttachment } from "@/server/domain/nyx/chatAttachmentRepository";
import { fetchUrlTextForNyx } from "@/server/domain/nyx/fetchUrlForNyx";

export async function buildChatAttachmentContext(input: {
  playerId: string;
  userQuestion: string;
  mediaId?: string | null;
  linkedUrl?: string | null;
}): Promise<{ attachmentContext: string; linkedUrl: string | null; displayText: string }> {
  const parts: string[] = [];
  let linkedUrl: string | null = input.linkedUrl?.trim() || null;

  if (input.mediaId) {
    const asset = await getPlayerChatAttachment(input.playerId, input.mediaId);
    if (!asset) throw new Error("Bijlage niet gevonden of geen toegang.");
    const summary = await analyzeChatAttachment({ asset, userQuestion: input.userQuestion });
    parts.push(summary);
  }

  if (linkedUrl) {
    const fetched = await fetchUrlTextForNyx(linkedUrl);
    if (fetched.ok) {
      linkedUrl = fetched.url;
      parts.push(`URL: ${fetched.url}\nTitel: ${fetched.title}\nInhoud (ingekort):\n${fetched.excerpt}`);
    } else {
      parts.push(`Link ${linkedUrl} — kon niet worden gelezen: ${fetched.error}`);
    }
  }

  const attachmentContext = formatAttachmentBlock({
    fileSummary: parts.join("\n\n"),
    urlSummary: "",
  });

  const displayText =
    input.userQuestion.trim() ||
    (input.mediaId && linkedUrl
      ? "Feedback op bijlage en link."
      : input.mediaId
        ? "Feedback op bijlage."
        : linkedUrl
          ? "Feedback op deze link."
          : "");

  return { attachmentContext, linkedUrl, displayText };
}
