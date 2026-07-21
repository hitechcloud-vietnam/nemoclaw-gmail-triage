import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as gmail from "../gmail/client.js";
import * as proposals from "../queue/proposals.js";
import { groupByPattern, type PatternGroup } from "../ui/pattern-grouping.js";
import type { IncomingMessage, ServerResponse } from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_DIR = join(__dirname, "..", "..", "src", "ui");

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  body: Record<string, unknown>
) => Promise<void>;

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// --- Route Handlers ---

const handleDashboard: RouteHandler = async (_req, res) => {
  const html = await readFile(join(UI_DIR, "dashboard.html"), "utf-8");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
};

const handleGetQueues: RouteHandler = async (_req, res) => {
  const labels = await gmail.listLabels();
  const triageLabels = labels.filter((l) => l.name.startsWith("AI-Triage/"));

  const queues = await Promise.all(
    triageLabels.map(async (label) => {
      const msgs = await gmail.searchMessages(`label:${label.name.replace(/\//g, "-")}`, 50);
      const messageDetails = msgs.messages
        ? await Promise.all(
            msgs.messages.slice(0, 50).map(async (m) => {
              const msg = await gmail.getMessage(m.id, "metadata");
              return {
                id: msg.id,
                threadId: msg.threadId,
                subject: gmail.getHeader(msg, "Subject") ?? "(no subject)",
                from: gmail.getHeader(msg, "From") ?? "unknown",
                date: gmail.getHeader(msg, "Date") ?? "",
                snippet: msg.snippet ?? "",
              };
            })
          )
        : [];

      const patterns = groupByPattern(messageDetails);

      return {
        label: label.name,
        labelId: label.id,
        total: label.messagesTotal ?? 0,
        unread: label.messagesUnread ?? 0,
        patterns,
      };
    })
  );

  json(res, { queues: queues.filter((q) => q.total > 0) });
};

const handleGetProposals: RouteHandler = async (_req, res) => {
  const all = await proposals.loadProposals();
  json(res, { proposals: all });
};

const handleArchive: RouteHandler = async (_req, res, body) => {
  const ids = body.messageIds as string[];
  if (!ids?.length) return json(res, { error: "messageIds required" }, 400);

  await gmail.batchModifyLabels(ids, [], ["INBOX"]);
  await proposals.appendAudit({ action: "archive", details: {}, messageIds: ids });
  json(res, { archived: ids.length });
};

const handleTrash: RouteHandler = async (_req, res, body) => {
  const ids = body.messageIds as string[];
  if (!ids?.length) return json(res, { error: "messageIds required" }, 400);

  for (const id of ids) {
    await gmail.trashMessage(id);
  }
  await proposals.appendAudit({ action: "trash", details: {}, messageIds: ids });
  json(res, { trashed: ids.length });
};

const handleMarkRead: RouteHandler = async (_req, res, body) => {
  const ids = body.messageIds as string[];
  if (!ids?.length) return json(res, { error: "messageIds required" }, 400);

  await gmail.batchModifyLabels(ids, [], ["UNREAD"]);
  await proposals.appendAudit({ action: "mark_read", details: {}, messageIds: ids });
  json(res, { markedRead: ids.length });
};

const handleApproveFilter: RouteHandler = async (_req, res, body) => {
  const proposalId = body.proposalId as string;
  if (!proposalId) return json(res, { error: "proposalId required" }, 400);

  const proposal = await proposals.getProposal(proposalId);
  if (!proposal || proposal.type !== "filter") {
    return json(res, { error: "Filter proposal not found" }, 404);
  }

  const filter = await gmail.createFilter(proposal.criteria, proposal.action);
  await proposals.removeProposal(proposalId);
  await proposals.appendAudit({
    action: "approve_filter",
    details: { filter },
    proposalId,
  });
  json(res, { approved: true, filterId: filter.id });
};

const handleRejectProposal: RouteHandler = async (_req, res, body) => {
  const proposalId = body.proposalId as string;
  if (!proposalId) return json(res, { error: "proposalId required" }, 400);

  const removed = await proposals.removeProposal(proposalId);
  if (!removed) return json(res, { error: "Proposal not found" }, 404);

  await proposals.appendAudit({
    action: "reject_proposal",
    details: { type: removed.type },
    proposalId,
  });
  json(res, { rejected: true });
};

const handleSendDraft: RouteHandler = async (_req, res, body) => {
  const proposalId = body.proposalId as string;
  if (!proposalId) return json(res, { error: "proposalId required" }, 400);

  const proposal = await proposals.getProposal(proposalId);
  if (!proposal || proposal.type !== "draft_reply") {
    return json(res, { error: "Draft reply proposal not found" }, 404);
  }

  const rawEmail = [
    `To: ${proposal.to}`,
    `Subject: ${proposal.subject}`,
    `In-Reply-To: ${proposal.threadId}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    proposal.body,
  ].join("\r\n");

  const encoded = Buffer.from(rawEmail)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sent = await gmail.sendMessage(encoded);
  await proposals.removeProposal(proposalId);
  await proposals.appendAudit({
    action: "send_draft",
    details: { messageId: sent.id },
    proposalId,
  });
  json(res, { sent: true, messageId: sent.id });
};

const handleAuditLog: RouteHandler = async (_req, res) => {
  const entries = await proposals.readAudit(100);
  json(res, { audit: entries });
};

const apiRoutes: Record<string, RouteHandler> = {
  "/api/queues": handleGetQueues,
  "/api/proposals": handleGetProposals,
  "/api/audit": handleAuditLog,
  "/api/archive": handleArchive,
  "/api/trash": handleTrash,
  "/api/mark-read": handleMarkRead,
  "/api/approve-filter": handleApproveFilter,
  "/api/reject-proposal": handleRejectProposal,
  "/api/send-draft": handleSendDraft,
};

export function registerRoutes(api: {
  registerHttpRoute: (params: {
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void> | boolean | void;
    auth: "gateway" | "plugin";
    match?: "exact" | "prefix";
  }) => void;
}): void {
  api.registerHttpRoute({
    path: "/gmail-triage",
    auth: "plugin",
    match: "prefix",
    async handler(req: IncomingMessage, res: ServerResponse) {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const subPath = url.pathname.replace(/^\/gmail-triage/, "") || "/";

        if (subPath === "/" || subPath === "") {
          const body = {};
          await handleDashboard(req, res, body);
          return;
        }

        const routeHandler = apiRoutes[subPath];
        if (!routeHandler) {
          json(res, { error: "Not found" }, 404);
          return;
        }

        const body = req.method === "POST" ? await readBody(req) : {};
        await routeHandler(req, res, body);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        json(res, { error: msg }, 500);
      }
    },
  });
}
