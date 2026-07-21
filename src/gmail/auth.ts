import { OAuth2Client } from "google-auth-library";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getScopes } from "./scopes.js";

const DATA_DIR = join(homedir(), ".openclaw-data", "gmail-triage");
const TOKEN_PATH = join(DATA_DIR, "tokens.json");

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

let cachedClient: OAuth2Client | null = null;

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set. " +
      "See README.md for Google Cloud setup instructions."
    );
  }
  return { clientId, clientSecret };
}

export async function getAuthClient(enableSend = false): Promise<OAuth2Client> {
  if (cachedClient) return cachedClient;

  const { clientId, clientSecret } = getClientCredentials();
  const client = new OAuth2Client(clientId, clientSecret, "http://127.0.0.1:0");

  try {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    const tokens: StoredTokens = JSON.parse(raw);
    client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });

    client.on("tokens", async (newTokens) => {
      const merged: StoredTokens = {
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
      };
      await saveTokens(merged);
    });

    cachedClient = client;
    return client;
  } catch {
    throw new Error(
      "Gmail not authenticated. Run /gmail setup to connect your account."
    );
  }
}

export async function runOAuthFlow(enableSend = false): Promise<OAuth2Client> {
  const { clientId, clientSecret } = getClientCredentials();

  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url!, `http://127.0.0.1`);
        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400);
          res.end("Missing authorization code");
          return;
        }

        const client = new OAuth2Client(clientId, clientSecret, redirectUri);
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        const stored: StoredTokens = {
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token!,
          expiry_date: tokens.expiry_date!,
        };
        await saveTokens(stored);

        client.on("tokens", async (newTokens) => {
          const merged: StoredTokens = {
            access_token: newTokens.access_token ?? stored.access_token,
            refresh_token: newTokens.refresh_token ?? stored.refresh_token,
            expiry_date: newTokens.expiry_date ?? stored.expiry_date,
          };
          await saveTokens(merged);
        });

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Gmail Triage connected!</h1><p>You can close this tab.</p>");
        server.close();
        cachedClient = client;
        resolve(client);
      } catch (err) {
        res.writeHead(500);
        res.end("OAuth error");
        server.close();
        reject(err);
      }
    });

    let redirectUri: string;

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start OAuth callback server"));
        return;
      }
      const port = addr.port;
      redirectUri = `http://127.0.0.1:${port}`;

      const tempClient = new OAuth2Client(clientId, clientSecret, redirectUri);
      const authUrl = tempClient.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: getScopes(enableSend),
      });

      console.log(`\nOpen this URL to authorize Gmail Triage:\n\n${authUrl}\n`);
    });
  });
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

export function isAuthenticated(): boolean {
  return cachedClient !== null;
}

export function clearCachedClient(): void {
  cachedClient = null;
}
