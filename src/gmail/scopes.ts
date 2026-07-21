export const SCOPES_BASE = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
] as const;

export const SCOPE_SEND = "https://www.googleapis.com/auth/gmail.send" as const;

export function getScopes(enableSend: boolean): string[] {
  const scopes: string[] = [...SCOPES_BASE];
  if (enableSend) scopes.push(SCOPE_SEND);
  return scopes;
}
