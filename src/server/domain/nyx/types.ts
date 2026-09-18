export type NyxMode = "COMPANION" | "ADVISOR" | "MISSION_CONTROL" | "DEBRIEF" | "OPPORTUNITY";
export type NyxMessageRole = "USER" | "NYX" | "SYSTEM";

export type NyxChatMessage = {
  id: string;
  role: "me" | "nyx";
  text: string;
};

export type NyxProposalCard = {
  id: string;
  title: string;
  duration: string;
  difficulty: string;
  xp: number;
  impact: string;
};

export type NyxTalkState = {
  conversationId: string;
  messages: NyxChatMessage[];
  proposal: NyxProposalCard | null;
};
