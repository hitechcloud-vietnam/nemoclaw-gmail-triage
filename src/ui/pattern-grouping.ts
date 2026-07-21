export interface MessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface PatternGroup {
  groupKey: string;
  groupType: "sender" | "subject_prefix";
  label: string;
  count: number;
  messages: MessageSummary[];
}

export function groupByPattern(messages: MessageSummary[]): PatternGroup[] {
  if (!messages.length) return [];

  const bySender = new Map<string, MessageSummary[]>();
  for (const msg of messages) {
    const sender = normalizeSender(msg.from);
    const bucket = bySender.get(sender) ?? [];
    bucket.push(msg);
    bySender.set(sender, bucket);
  }

  const groups: PatternGroup[] = [];

  for (const [sender, msgs] of bySender) {
    if (msgs.length >= 2) {
      groups.push({
        groupKey: `sender:${sender}`,
        groupType: "sender",
        label: sender,
        count: msgs.length,
        messages: msgs.sort(byDateDesc),
      });
    }
  }

  const ungrouped = messages.filter(
    (m) => !groups.some((g) => g.messages.includes(m))
  );

  const byPrefix = new Map<string, MessageSummary[]>();
  for (const msg of ungrouped) {
    const prefix = extractSubjectPrefix(msg.subject);
    if (prefix) {
      const bucket = byPrefix.get(prefix) ?? [];
      bucket.push(msg);
      byPrefix.set(prefix, bucket);
    }
  }

  for (const [prefix, msgs] of byPrefix) {
    if (msgs.length >= 2) {
      groups.push({
        groupKey: `subject:${prefix}`,
        groupType: "subject_prefix",
        label: prefix,
        count: msgs.length,
        messages: msgs.sort(byDateDesc),
      });
    }
  }

  const grouped = new Set(groups.flatMap((g) => g.messages.map((m) => m.id)));
  const remaining = messages.filter((m) => !grouped.has(m.id));

  if (remaining.length > 0) {
    groups.push({
      groupKey: "other",
      groupType: "sender",
      label: "Other",
      count: remaining.length,
      messages: remaining.sort(byDateDesc),
    });
  }

  return groups.sort((a, b) => b.count - a.count);
}

function normalizeSender(from: string): string {
  const match = from.match(/<([^>]+)>/);
  const email = match ? match[1] : from;
  const domain = email.split("@")[1] ?? email;
  return domain.toLowerCase();
}

function extractSubjectPrefix(subject: string): string | null {
  const clean = subject.replace(/^(Re|Fwd|Fw):\s*/gi, "").trim();
  const bracketMatch = clean.match(/^\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];

  const parts = clean.split(/[:\-–—]/);
  if (parts.length > 1 && parts[0].trim().length < 30) {
    return parts[0].trim();
  }

  return null;
}

function byDateDesc(a: MessageSummary, b: MessageSummary): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}
