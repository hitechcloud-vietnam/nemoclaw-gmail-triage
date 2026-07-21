import { isAuthenticated, runOAuthFlow } from "../gmail/auth.js";
import * as gmail from "../gmail/client.js";
import { loadProposals } from "../queue/proposals.js";

export const gmailSetupCommand = {
  name: "gmail-setup",
  description: "Connect your Gmail account via OAuth",
  async handler() {
    if (isAuthenticated()) {
      return { text: "Gmail is already connected. Use /gmail-status to check." };
    }
    try {
      await runOAuthFlow();
      return { text: "Gmail connected successfully!" };
    } catch (err) {
      return { text: `OAuth failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

export const gmailStatusCommand = {
  name: "gmail-status",
  description: "Show Gmail Triage connection status and queue summary",
  async handler() {
    if (!isAuthenticated()) {
      return { text: "Gmail not connected. Run /gmail-setup first." };
    }

    try {
      const labels = await gmail.listLabels();
      const inbox = labels.find((l) => l.name === "INBOX");
      const triageLabels = labels.filter((l) => l.name.startsWith("AI-Triage/"));
      const proposals = await loadProposals();

      const lines = [
        `**Gmail Triage Status**`,
        `- Inbox: ${inbox?.messagesTotal ?? "?"} messages (${inbox?.messagesUnread ?? "?"} unread)`,
        `- Triage queues: ${triageLabels.length}`,
        `- Pending proposals: ${proposals.length}`,
        ``,
        `Open the [Gmail Triage Dashboard](/gmail-triage) to review queues and take action.`,
      ];

      return { text: lines.join("\n") };
    } catch (err) {
      return { text: `Error: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

export const gmailReviewCommand = {
  name: "gmail-review",
  description: "Show pending triage proposals for review",
  async handler() {
    if (!isAuthenticated()) {
      return { text: "Gmail not connected. Run /gmail-setup first." };
    }

    try {
      const proposals = await loadProposals();
      if (!proposals.length) {
        return { text: "No pending proposals. Open the [Dashboard](/gmail-triage) to review triage queues." };
      }

      const lines = [
        `**${proposals.length} Pending Proposal${proposals.length > 1 ? "s" : ""}**`,
        "",
      ];

      for (const p of proposals.slice(0, 5)) {
        if (p.type === "filter") {
          lines.push(`- **Filter**: ${p.reasoning} (matches ~${p.matchingMessageCount ?? "?"} messages)`);
        } else {
          lines.push(`- **Draft Reply** to ${p.to}: ${p.reasoning}`);
        }
      }

      if (proposals.length > 5) {
        lines.push(`- ...and ${proposals.length - 5} more`);
      }

      lines.push("", "Open the [Gmail Triage Dashboard](/gmail-triage) to approve or reject.");
      return { text: lines.join("\n") };
    } catch (err) {
      return { text: `Error: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
