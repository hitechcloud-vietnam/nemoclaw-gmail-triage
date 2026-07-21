import type { OAuth2Client } from "google-auth-library";
import { getAuthClient } from "./auth.js";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface RequestOpts {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
}

async function gmailFetch<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const client = await getAuthClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("No access token available");

  const url = new URL(`${BASE}${path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Messages ---

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    body?: { data?: string };
    mimeType?: string;
  };
  internalDate?: string;
}

export interface MessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export async function searchMessages(
  query: string,
  maxResults = 50,
  pageToken?: string
): Promise<MessageListResponse> {
  const params: Record<string, string> = { q: query, maxResults: String(maxResults) };
  if (pageToken) params.pageToken = pageToken;
  return gmailFetch<MessageListResponse>("/messages", { params });
}

export async function getMessage(id: string, format = "full"): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(`/messages/${id}`, {
    params: { format },
  });
}

// --- Threads ---

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

export async function getThread(id: string, format = "full"): Promise<GmailThread> {
  return gmailFetch<GmailThread>(`/threads/${id}`, {
    params: { format },
  });
}

// --- Labels ---

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface LabelListResponse {
  labels: GmailLabel[];
}

export async function listLabels(): Promise<GmailLabel[]> {
  const res = await gmailFetch<LabelListResponse>("/labels");
  return res.labels ?? [];
}

export async function createLabel(name: string): Promise<GmailLabel> {
  return gmailFetch<GmailLabel>("/labels", {
    method: "POST",
    body: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
}

export async function modifyMessageLabels(
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(`/messages/${messageId}/modify`, {
    method: "POST",
    body: { addLabelIds, removeLabelIds },
  });
}

export async function batchModifyLabels(
  messageIds: string[],
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<void> {
  await gmailFetch<void>("/messages/batchModify", {
    method: "POST",
    body: { ids: messageIds, addLabelIds, removeLabelIds },
  });
}

// --- Filters ---

export interface GmailFilter {
  id: string;
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
    forward?: string;
  };
}

export async function listFilters(): Promise<GmailFilter[]> {
  const res = await gmailFetch<{ filter: GmailFilter[] }>("/settings/filters");
  return res.filter ?? [];
}

export async function createFilter(
  criteria: GmailFilter["criteria"],
  action: GmailFilter["action"]
): Promise<GmailFilter> {
  return gmailFetch<GmailFilter>("/settings/filters", {
    method: "POST",
    body: { criteria, action },
  });
}

// --- Send (UI only) ---

export async function sendMessage(raw: string): Promise<{ id: string; threadId: string }> {
  return gmailFetch<{ id: string; threadId: string }>("/messages/send", {
    method: "POST",
    body: { raw },
  });
}

// --- Trash (UI only) ---

export async function trashMessage(messageId: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(`/messages/${messageId}/trash`, {
    method: "POST",
  });
}

// --- Helpers ---

export function decodeBody(encoded?: string): string {
  if (!encoded) return "";
  return Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

export function getHeader(msg: GmailMessage, name: string): string | undefined {
  return msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

export function getPlainTextBody(msg: GmailMessage): string {
  const payload = msg.payload;
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  const textPart = payload.parts?.find((p) => p.mimeType === "text/plain");
  if (textPart?.body?.data) {
    return decodeBody(textPart.body.data);
  }

  if (payload.body?.data) {
    return decodeBody(payload.body.data);
  }

  return "";
}
