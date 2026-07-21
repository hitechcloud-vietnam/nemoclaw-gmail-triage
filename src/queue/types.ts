export interface FilterProposal {
  id: string;
  type: "filter";
  createdAt: string;
  reasoning: string;
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
    archive?: boolean;
    markRead?: boolean;
  };
  matchingMessageCount?: number;
}

export interface DraftReplyProposal {
  id: string;
  type: "draft_reply";
  createdAt: string;
  reasoning: string;
  threadId: string;
  subject: string;
  to: string;
  body: string;
}

export type Proposal = FilterProposal | DraftReplyProposal;

export type NewFilterProposal = Omit<FilterProposal, "id" | "createdAt">;
export type NewDraftReplyProposal = Omit<DraftReplyProposal, "id" | "createdAt">;
export type NewProposal = NewFilterProposal | NewDraftReplyProposal;

export interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
  messageIds?: string[];
  proposalId?: string;
}
