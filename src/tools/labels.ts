import { Type } from "@sinclair/typebox";
import * as gmail from "../gmail/client.js";

const TRIAGE_PREFIX_DEFAULT = "AI-Triage";

function getPrefix(): string {
  return TRIAGE_PREFIX_DEFAULT;
}

export const gmailListLabelsTool = {
  name: "gmail_list_labels",
  label: "List Labels",
  description: "List all Gmail labels with message and unread counts.",
  parameters: Type.Object({}),
  async execute() {
    const labels = await gmail.listLabels();
    const sorted = labels
      .map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        total: l.messagesTotal ?? 0,
        unread: l.messagesUnread ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { content: [{ type: "text" as const, text: JSON.stringify(sorted, null, 2) }], details: {} };
  },
};

export const gmailCreateLabelTool = {
  name: "gmail_create_label",
  label: "Create Triage Label",
  description:
    `Create a new Gmail label under the triage prefix (${TRIAGE_PREFIX_DEFAULT}/). ` +
    "Used to build the triage queue taxonomy. " +
    "Example: category='Archive/Newsletters' creates 'AI-Triage/Archive/Newsletters'.",
  parameters: Type.Object({
    category: Type.String({
      description: "Label path under the triage prefix, e.g. 'Archive/Newsletters' or 'Respond/Colleagues'",
    }),
  }),
  async execute(_id: string, params: { category: string }) {
    const prefix = getPrefix();
    const depth = params.category.split("/").length;
    if (depth > 3) {
      return {
        content: [{ type: "text" as const, text: "Error: Max label depth is 3 levels under the triage prefix." }],
        details: {},
      };
    }

    const fullName = `${prefix}/${params.category}`;

    const existing = await gmail.listLabels();
    const found = existing.find((l) => l.name === fullName);
    if (found) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ exists: true, id: found.id, name: found.name }) }],
        details: {},
      };
    }

    const label = await gmail.createLabel(fullName);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ created: true, id: label.id, name: label.name }) }],
      details: {},
    };
  },
};

export const gmailApplyLabelsTool = {
  name: "gmail_apply_labels",
  label: "Apply Triage Labels",
  description:
    `Apply or remove triage labels (under ${TRIAGE_PREFIX_DEFAULT}/) on messages. ` +
    "ONLY triage labels can be modified — system labels (INBOX, TRASH, SPAM) and user labels outside the triage prefix are blocked.",
  parameters: Type.Object({
    messageIds: Type.Array(Type.String(), { description: "Gmail message IDs to modify" }),
    addLabels: Type.Optional(
      Type.Array(Type.String(), { description: "Triage label names to add (full path including prefix)" })
    ),
    removeLabels: Type.Optional(
      Type.Array(Type.String(), { description: "Triage label names to remove (full path including prefix)" })
    ),
  }),
  async execute(
    _id: string,
    params: { messageIds: string[]; addLabels?: string[]; removeLabels?: string[] }
  ) {
    const prefix = getPrefix();
    const allRequestedLabels = [...(params.addLabels ?? []), ...(params.removeLabels ?? [])];

    for (const name of allRequestedLabels) {
      if (!name.startsWith(`${prefix}/`)) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: Label "${name}" is outside the triage prefix "${prefix}/". Only triage labels can be modified by the agent.`,
          }],
          details: {},
        };
      }
    }

    const labels = await gmail.listLabels();
    const nameToId = new Map(labels.map((l) => [l.name, l.id]));

    const addIds = (params.addLabels ?? []).map((name) => {
      const id = nameToId.get(name);
      if (!id) throw new Error(`Label not found: ${name}`);
      return id;
    });

    const removeIds = (params.removeLabels ?? []).map((name) => {
      const id = nameToId.get(name);
      if (!id) throw new Error(`Label not found: ${name}`);
      return id;
    });

    if (params.messageIds.length > 1) {
      await gmail.batchModifyLabels(params.messageIds, addIds, removeIds);
    } else if (params.messageIds.length === 1) {
      await gmail.modifyMessageLabels(params.messageIds[0], addIds, removeIds);
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          modified: params.messageIds.length,
          added: params.addLabels ?? [],
          removed: params.removeLabels ?? [],
        }),
      }],
      details: {},
    };
  },
};
