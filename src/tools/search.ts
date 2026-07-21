import { Type } from "@sinclair/typebox";
import { searchMessages, getMessage, getHeader } from "../gmail/client.js";

export const gmailSearchTool = {
  name: "gmail_search",
  label: "Gmail Search",
  description:
    "Search Gmail messages using Gmail search syntax (e.g. 'from:someone@example.com', 'is:unread', 'subject:invoice'). " +
    "Returns message summaries with id, subject, sender, date, snippet, and labels.",
  parameters: Type.Object({
    query: Type.String({ description: "Gmail search query" }),
    maxResults: Type.Optional(Type.Number({ description: "Max results (default 50, max 100)", default: 50 })),
    pageToken: Type.Optional(Type.String({ description: "Pagination token from previous search" })),
  }),
  async execute(_id: string, params: { query: string; maxResults?: number; pageToken?: string }) {
    const max = Math.min(params.maxResults ?? 50, 100);
    const res = await searchMessages(params.query, max, params.pageToken);

    if (!res.messages?.length) {
      return { content: [{ type: "text" as const, text: "No messages found." }], details: {} };
    }

    const summaries = await Promise.all(
      res.messages.slice(0, 20).map(async (m) => {
        const msg = await getMessage(m.id, "metadata");
        return {
          id: msg.id,
          threadId: msg.threadId,
          subject: getHeader(msg, "Subject") ?? "(no subject)",
          from: getHeader(msg, "From") ?? "unknown",
          date: getHeader(msg, "Date") ?? "",
          snippet: msg.snippet ?? "",
          labels: msg.labelIds ?? [],
        };
      })
    );

    const result = {
      total: res.resultSizeEstimate ?? summaries.length,
      showing: summaries.length,
      nextPageToken: res.nextPageToken ?? null,
      messages: summaries,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], details: {} };
  },
};
