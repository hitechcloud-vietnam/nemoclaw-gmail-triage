import { Type } from "@sinclair/typebox";
import * as gmail from "../gmail/client.js";

export const gmailInboxStatsTool = {
  name: "gmail_inbox_stats",
  label: "Inbox Statistics",
  description:
    "Get aggregate inbox statistics: total unread, unread by label, and top senders. " +
    "Useful for getting a birds-eye view before diving into triage.",
  parameters: Type.Object({}),
  async execute() {
    const labels = await gmail.listLabels();

    const inbox = labels.find((l) => l.name === "INBOX");
    const inboxTotal = inbox?.messagesTotal ?? 0;
    const inboxUnread = inbox?.messagesUnread ?? 0;

    const triageLabels = labels
      .filter((l) => l.name.startsWith("AI-Triage/"))
      .map((l) => ({ name: l.name, total: l.messagesTotal ?? 0, unread: l.messagesUnread ?? 0 }))
      .filter((l) => l.total > 0)
      .sort((a, b) => b.total - a.total);

    const topSenders = await getTopSenders();

    const stats = {
      inbox: { total: inboxTotal, unread: inboxUnread },
      triageQueues: triageLabels,
      topSenders,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }], details: {} };
  },
};

async function getTopSenders(): Promise<Array<{ sender: string; count: number }>> {
  const res = await gmail.searchMessages("is:unread in:inbox", 100);
  if (!res.messages?.length) return [];

  const senderCounts = new Map<string, number>();

  const sample = res.messages.slice(0, 50);
  const messages = await Promise.all(
    sample.map((m) => gmail.getMessage(m.id, "metadata"))
  );

  for (const msg of messages) {
    const from = gmail.getHeader(msg, "From") ?? "unknown";
    const clean = from.replace(/<[^>]+>/g, "").trim() || from;
    senderCounts.set(clean, (senderCounts.get(clean) ?? 0) + 1);
  }

  return [...senderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([sender, count]) => ({ sender, count }));
}
