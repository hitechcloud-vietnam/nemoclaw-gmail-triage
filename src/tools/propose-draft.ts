import { Type } from "@sinclair/typebox";
import { addProposal } from "../queue/proposals.js";

export const gmailProposeDraftReplyTool = {
  name: "gmail_propose_draft_reply",
  label: "Propose Draft Reply",
  description:
    "Propose a draft reply to an email thread. The reply will NOT be sent or saved as a Gmail draft " +
    "until the user approves it through the web UI. Include your reasoning.",
  parameters: Type.Object({
    reasoning: Type.String({ description: "Why this reply is appropriate (shown to user during review)" }),
    threadId: Type.String({ description: "Gmail thread ID to reply to" }),
    subject: Type.String({ description: "Email subject line" }),
    to: Type.String({ description: "Recipient email address" }),
    body: Type.String({ description: "Plain text reply body" }),
  }),
  async execute(
    _id: string,
    params: {
      reasoning: string;
      threadId: string;
      subject: string;
      to: string;
      body: string;
    }
  ) {
    const proposal = await addProposal({
      type: "draft_reply",
      reasoning: params.reasoning,
      threadId: params.threadId,
      subject: params.subject,
      to: params.to,
      body: params.body,
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          proposed: true,
          proposalId: proposal.id,
          message: "Draft reply proposal saved. User will review in the Gmail Triage UI.",
        }),
      }],
      details: {},
    };
  },
};
