export type NyxMode = "COMPANION" | "ADVISOR" | "MISSION_CONTROL" | "DEBRIEF" | "OPPORTUNITY";
export type NyxMessageRole = "USER" | "NYX" | "SYSTEM";

export type NyxChatMessage = {
  id: string;
  role: "me" | "nyx";
  text: string;
  mediaSrc?: string | null;
  mediaKind?: "image" | "video" | null;
};

export type NyxProposalCard = {
  id: string;
  title: string;
  duration: string;
  difficulty: string;
  xp: number;
  impact: string;
};

export type NyxMemoryChip = {
  id: string;
  label: string;
  fact: string;
};

export type NyxPatternCard = {
  id: string;
  title: string;
  description: string;
};

export type NyxReviewCard = {
  id: string;
  bottleneck: string;
  whatStays: string;
};

export type NyxTalkState = {
  conversationId: string;
  messages: NyxChatMessage[];
  proposal: NyxProposalCard | null;
  memoryChips: NyxMemoryChip[];
  pattern: NyxPatternCard | null;
  review: NyxReviewCard | null;
};
