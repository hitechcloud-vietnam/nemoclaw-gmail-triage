import { Type } from "@sinclair/typebox";
import { addProposal } from "../queue/proposals.js";

export const gmailProposeFilterTool = {
  name: "gmail_propose_filter",
  label: "Propose Filter",
  description:
    "Propose a Gmail filter for user review. The filter will NOT be created until the user approves it " +
    "through the web UI or /gmail review command. Include your reasoning for why this filter would help.",
  parameters: Type.Object({
    reasoning: Type.String({ description: "Why this filter is useful (shown to user during review)" }),
    criteria: Type.Object({
      from: Type.Optional(Type.String({ description: "Sender email or pattern" })),
      to: Type.Optional(Type.String({ description: "Recipient email or pattern" })),
      subject: Type.Optional(Type.String({ description: "Subject line pattern" })),
      query: Type.Optional(Type.String({ description: "Full Gmail search query" })),
    }),
    action: Type.Object({
      archive: Type.Optional(Type.Boolean({ description: "Skip inbox (archive)" })),
      markRead: Type.Optional(Type.Boolean({ description: "Mark as read" })),
      addLabelNames: Type.Optional(Type.Array(Type.String(), { description: "Label names to apply" })),
    }),
    matchingMessageCount: Type.Optional(
      Type.Number({ description: "Approximate number of existing messages matching this filter" })
    ),
  }),
  async execute(
    _id: string,
    params: {
      reasoning: string;
      criteria: { from?: string; to?: string; subject?: string; query?: string };
      action: { archive?: boolean; markRead?: boolean; addLabelNames?: string[] };
      matchingMessageCount?: number;
    }
  ) {
    const proposal = await addProposal({
      type: "filter",
      reasoning: params.reasoning,
      criteria: params.criteria,
      action: {
        removeLabelIds: [
          ...(params.action.archive ? ["INBOX"] : []),
          ...(params.action.markRead ? ["UNREAD"] : []),
        ],
        addLabelIds: [],
      },
      matchingMessageCount: params.matchingMessageCount,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          proposed: true,
          proposalId: proposal.id,
          message: "Filter proposal saved. User will review in the Gmail Triage UI.",
        }),
      }],
      details: {},
    };
  },
};
