import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { gmailSearchTool } from "./tools/search.js";
import { gmailReadThreadTool } from "./tools/read-thread.js";
import { gmailListLabelsTool, gmailCreateLabelTool, gmailApplyLabelsTool } from "./tools/labels.js";
import { gmailInboxStatsTool } from "./tools/stats.js";
import { gmailProposeFilterTool } from "./tools/propose-filter.js";
import { gmailProposeDraftReplyTool } from "./tools/propose-draft.js";
import { registerRoutes } from "./routes/ui-routes.js";
import { gmailSetupCommand, gmailStatusCommand, gmailReviewCommand } from "./commands/gmail.js";

export default definePluginEntry({
  id: "gmail-triage",
  name: "Gmail Triage",
  description: "AI-powered Gmail inbox triage with human-in-the-loop approval",
  register(api) {
    api.registerTool(gmailSearchTool);
    api.registerTool(gmailReadThreadTool);
    api.registerTool(gmailListLabelsTool);
    api.registerTool(gmailCreateLabelTool);
    api.registerTool(gmailApplyLabelsTool);
    api.registerTool(gmailInboxStatsTool);
    api.registerTool(gmailProposeFilterTool);
    api.registerTool(gmailProposeDraftReplyTool);

    registerRoutes(api as any);

    api.registerCommand(gmailSetupCommand);
    api.registerCommand(gmailStatusCommand);
    api.registerCommand(gmailReviewCommand);
  },
});
