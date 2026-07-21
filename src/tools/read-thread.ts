import { Type } from "@sinclair/typebox";
import { getThread, getHeader, getPlainTextBody } from "../gmail/client.js";

export const gmailReadThreadTool = {
  name: "gmail_read_thread",
  label: "Read Gmail Thread",
  description:
    "Read a full Gmail thread by ID. Returns all messages with headers, plain text body, and attachment metadata.",
  parameters: Type.Object({
    threadId: Type.String({ description: "Gmail thread ID" }),
  }),
  async execute(_id: string, params: { threadId: string }) {
    const thread = await getThread(params.threadId);

    const messages = thread.messages.map((msg) => ({
      id: msg.id,
      from: getHeader(msg, "From") ?? "unknown",
      to: getHeader(msg, "To") ?? "",
      cc: getHeader(msg, "Cc") ?? "",
      subject: getHeader(msg, "Subject") ?? "(no subject)",
      date: getHeader(msg, "Date") ?? "",
      labels: msg.labelIds ?? [],
      body: getPlainTextBody(msg).slice(0, 4000),
      hasAttachments: (msg.payload?.parts?.filter(
        (p) => p.mimeType !== "text/plain" && p.mimeType !== "text/html"
      )?.length ?? 0) > 0,
    }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ threadId: thread.id, messageCount: messages.length, messages }, null, 2),
      }],
      details: {},
    };
  },
};
