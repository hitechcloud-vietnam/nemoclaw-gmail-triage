# Gmail Triage — NemoClaw Plugin

AI-powered Gmail inbox triage with a **read-only-by-design** agent and **human-in-the-loop** approval for all destructive actions.

## Architecture

```
Agent (Brain Layer)           User (Web UI)
  │                              │
  ├─ gmail_search                ├─ Archive (bulk)
  ├─ gmail_read_thread           ├─ Trash (bulk)
  ├─ gmail_list_labels           ├─ Mark Read (bulk)
  ├─ gmail_inbox_stats           ├─ Approve Filter
  ├─ gmail_create_label ─┐       ├─ Send Draft Reply
  ├─ gmail_apply_labels ─┤       └─ Reject Proposal
  ├─ gmail_propose_filter ─→ Proposal Store ←─┘
  └─ gmail_propose_draft   ─→ Audit Log
```

### Security Model

1. **Agent tools are read-only + label-only**: The agent can search, read, list labels, create labels (under `AI-Triage/` prefix only), and apply triage labels. It **cannot** archive, trash, send, or delete.

2. **Proposals, not actions**: Filters and draft replies are written to a local proposal store. The user reviews and approves/rejects through the web UI.

3. **User executes destructive actions**: The web dashboard talks directly to Gmail APIs for archive, trash, mark-read, filter creation, and sending — bypassing the agent entirely.

4. **NemoClaw network policy**: Outbound connections are restricted to `gmail.googleapis.com`, `oauth2.googleapis.com`, and `accounts.google.com` only.

5. **Full audit trail**: Every user action is logged to an append-only JSONL audit file.

## Prerequisites

- Node.js 20+
- An OpenClaw/NemoClaw instance
- A Google Cloud project with Gmail API enabled

## Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable the **Gmail API**
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Application type: **Desktop app**
6. Download the credentials and note the `Client ID` and `Client Secret`

## Installation

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/nemoclaw-gmail-triage.git
cd nemoclaw-gmail-triage

# Install dependencies
npm install

# Copy env and fill in Google credentials
cp .env.example .env
# Edit .env with your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

# Build
npm run build
```

## Usage

### Connect Gmail

In OpenClaw chat:
```
/gmail setup
```
This opens an OAuth consent flow in your browser. Approve the requested scopes.

### Triage

Ask the agent to triage your inbox:
```
Can you triage my unread inbox? Categorize by priority and type.
```

The agent will:
1. Search and read your messages
2. Create triage labels under `AI-Triage/`
3. Apply labels to categorize messages
4. Propose filters for recurring patterns

### Review

```
/gmail review
```
Or open the **Gmail Triage Dashboard** (linked in the response) to:
- View messages grouped by pattern (sender domain, subject prefix)
- Bulk archive, trash, or mark-read
- Approve or reject filter proposals
- Review and send draft replies

### Status

```
/gmail status
```

## OAuth Scopes

| Scope | Purpose | Used By |
|-------|---------|---------|
| `gmail.readonly` | Read messages and threads | Agent |
| `gmail.labels` | Create and manage labels | Agent |
| `gmail.modify` | Apply labels to messages | Agent + UI |
| `gmail.settings.basic` | Create filters | UI only |
| `gmail.send` (optional) | Send approved draft replies | UI only |

## Development

```bash
npm run dev    # Watch mode
npm run build  # One-time build
```

## License

MIT
