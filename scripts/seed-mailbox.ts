#!/usr/bin/env npx tsx
/**
 * Seed a test Gmail mailbox with ~1000 diverse emails via messages.insert.
 *
 * Usage:
 *   1. Complete OAuth setup first: npm run build && node dist/index.js (or /gmail setup)
 *   2. Run: npx tsx scripts/seed-mailbox.ts
 *
 * messages.insert bypasses sending — it places messages directly in the mailbox
 * with whatever headers, dates, and labels you specify. Requires gmail.modify scope.
 */

import { OAuth2Client } from "google-auth-library";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const TOKEN_PATH = join(homedir(), ".openclaw-data", "gmail-triage", "tokens.json");
const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TARGET_COUNT = 1000;
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 1200;

// --- Templates ---

interface EmailTemplate {
  category: string;
  weight: number;
  generate: (idx: number) => { from: string; subject: string; body: string; labels?: string[] };
}

const NAMES = [
  "Alice Chen", "Bob Martinez", "Carol Nakamura", "Dave Okonkwo", "Eva Petrov",
  "Frank Rivera", "Grace Kim", "Hank Johansson", "Iris Gupta", "Jake Thompson",
  "Kara Singh", "Leo Fernandez", "Mia Tanaka", "Noah Williams", "Olivia Dupont",
];

const DOMAINS = [
  "acmecorp.com", "globex.io", "initech.dev", "umbrella.co", "waynetech.org",
  "starkindustries.net", "oscorp.biz", "lexcorp.com", "dailyplanet.news",
];

const NEWSLETTER_SOURCES = [
  { name: "Morning Brew", domain: "morningbrew.com" },
  { name: "The Hustle", domain: "thehustle.co" },
  { name: "TLDR Tech", domain: "tldrnewsletter.com" },
  { name: "Hacker Newsletter", domain: "hackernewsletter.com" },
  { name: "Dense Discovery", domain: "densediscovery.com" },
  { name: "Benedict's Newsletter", domain: "ben-evans.com" },
  { name: "Stratechery", domain: "stratechery.com" },
  { name: "Platformer", domain: "platformer.news" },
];

const PROMO_BRANDS = [
  "Amazon", "Nike", "Apple", "Target", "Best Buy", "Costco", "REI",
  "Airbnb", "DoorDash", "Uber", "Spotify", "Adobe", "Figma",
];

const GITHUB_REPOS = [
  "kubernetes/kubernetes", "microsoft/vscode", "vercel/next.js", "facebook/react",
  "denoland/deno", "rust-lang/rust", "golang/go", "openai/whisper",
  "langchain-ai/langchain", "huggingface/transformers",
];

const SAAS_PRODUCTS = [
  "Notion", "Linear", "Slack", "Figma", "Vercel", "Datadog",
  "PlanetScale", "Supabase", "Fly.io", "Railway",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickName(): string { return pick(NAMES); }
function pickDomain(): string { return pick(DOMAINS); }
function emailAddr(name: string, domain: string): string {
  return `${name.toLowerCase().replace(/\s/g, ".")}@${domain}`;
}

function daysAgo(min: number, max: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * (max - min) + min));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d;
}

const templates: EmailTemplate[] = [
  {
    category: "newsletter",
    weight: 20,
    generate: (idx) => {
      const src = pick(NEWSLETTER_SOURCES);
      const edition = 200 + idx;
      return {
        from: `${src.name} <newsletter@${src.domain}>`,
        subject: `${src.name} #${edition}: ${pick([
          "The AI race heats up", "Why everyone is talking about agents",
          "This week in tech", "The future of work is here",
          "Five things you missed", "The big story this week",
          "What founders are reading", "Market moves and maker news",
        ])}`,
        body: `Here's your ${pick(["daily", "weekly"])} digest from ${src.name}.\n\n` +
          `Top story: ${pick(["OpenAI releases new model", "Apple Vision Pro sales data", "Stripe raises rates", "GitHub Copilot gets agents", "AWS re:Invent announcements"])}\n\n` +
          `Read more at https://${src.domain}/issue/${edition}\n\nUnsubscribe: https://${src.domain}/unsub`,
      };
    },
  },
  {
    category: "work-internal",
    weight: 18,
    generate: () => {
      const sender = pickName();
      const domain = pickDomain();
      const topics = [
        { subj: "Q2 planning doc — feedback needed", body: "Hey team, I've put together the Q2 planning doc. Please review by EOW." },
        { subj: "Standup notes — {date}", body: "Blockers: None\nYesterday: Shipped auth refactor\nToday: Starting on caching layer" },
        { subj: "Quick sync on the API redesign?", body: "Can we grab 15 min today? I have some questions about the new endpoint structure." },
        { subj: "PR Review: Fix race condition in job queue", body: "This one's been causing intermittent failures in staging. Take a look when you can." },
        { subj: "Heads up: deploying v2.3.1 to prod at 3pm", body: "Mostly bug fixes + the new rate limiter. Rollback plan is ready." },
        { subj: "Re: Architecture decision — event sourcing", body: "I've been thinking more about this. Event sourcing adds complexity but gives us a clean audit trail." },
        { subj: "1:1 agenda for Thursday", body: "Topics: Career growth, project allocation, that conference in June." },
        { subj: "Team retro action items", body: "1. Improve test coverage on the payments module\n2. Set up better monitoring alerts\n3. Document the deploy process" },
        { subj: "FYI: New security policy for API keys", body: "Starting next week, all API keys rotate every 90 days. Update your .env files accordingly." },
        { subj: "Interview feedback — senior backend candidate", body: "Strong systems design, good communication. Recommend moving to final round." },
      ];
      const t = pick(topics);
      return {
        from: `${sender} <${emailAddr(sender, domain)}>`,
        subject: t.subj.replace("{date}", new Date().toLocaleDateString()),
        body: `Hi,\n\n${t.body}\n\nBest,\n${sender}`,
      };
    },
  },
  {
    category: "receipts",
    weight: 10,
    generate: (idx) => {
      const brand = pick(PROMO_BRANDS);
      const amount = (Math.random() * 200 + 5).toFixed(2);
      const orderId = `ORD-${100000 + idx}`;
      return {
        from: `${brand} <orders@${brand.toLowerCase().replace(/\s/g, "")}.com>`,
        subject: `Your ${brand} order confirmation (${orderId})`,
        body: `Thank you for your purchase!\n\nOrder: ${orderId}\nTotal: $${amount}\n\nEstimated delivery: ${pick(["3-5 business days", "Tomorrow", "Next week"])}\n\nTrack your order: https://${brand.toLowerCase()}.com/orders/${orderId}`,
      };
    },
  },
  {
    category: "github",
    weight: 12,
    generate: () => {
      const repo = pick(GITHUB_REPOS);
      const user = pick(NAMES).toLowerCase().replace(/\s/g, "");
      const types = [
        { subj: `[${repo}] Issue #${1000 + Math.floor(Math.random() * 9000)}: ${pick(["Bug: OOM on large datasets", "Feature request: streaming support", "Docs: clarify configuration", "Performance regression in v3.2"])}`, body: "A new issue was opened." },
        { subj: `[${repo}] PR #${500 + Math.floor(Math.random() * 500)} merged: ${pick(["Fix memory leak", "Add retry logic", "Update dependencies", "Refactor middleware"])}`, body: `@${user} merged this pull request.` },
        { subj: `[${repo}] @${user} mentioned you in a comment`, body: `"@you I think this approach makes sense. Can you take a look at the test failures though?"` },
        { subj: `[${repo}] New release: v${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 10)}`, body: "Changelog:\n- Bug fixes\n- Performance improvements\n- New API endpoints" },
      ];
      const t = pick(types);
      return {
        from: `GitHub <notifications@github.com>`,
        subject: t.subj,
        body: t.body + `\n\nView on GitHub: https://github.com/${repo}`,
      };
    },
  },
  {
    category: "saas-notifications",
    weight: 10,
    generate: () => {
      const product = pick(SAAS_PRODUCTS);
      const types = [
        { subj: `[${product}] Your weekly summary`, body: `Here's what happened in your ${product} workspace this week.` },
        { subj: `[${product}] New comment on "${pick(["API redesign", "Q2 roadmap", "Bug bash", "Design system"])}"`, body: "Someone left a comment on an item you're following." },
        { subj: `[${product}] Billing: Your invoice for ${pick(["March", "April", "May"])} is ready`, body: "Your monthly invoice is available for download." },
        { subj: `[${product}] ${pick(["Scheduled maintenance", "New feature", "Security update"])}`, body: `We're making improvements to ${product}.` },
      ];
      const t = pick(types);
      return {
        from: `${product} <notifications@${product.toLowerCase().replace(/\./g, "")}.com>`,
        subject: t.subj,
        body: t.body,
      };
    },
  },
  {
    category: "promotional",
    weight: 12,
    generate: () => {
      const brand = pick(PROMO_BRANDS);
      const discount = pick(["20%", "30%", "40%", "50%", "BOGO"]);
      return {
        from: `${brand} <deals@${brand.toLowerCase().replace(/\s/g, "")}.com>`,
        subject: pick([
          `${discount} off — ${pick(["today only!", "this weekend", "ends tomorrow", "limited time"])}`,
          `${brand}: New arrivals you'll love`,
          `Don't miss out — ${brand} ${pick(["Spring", "Summer", "Holiday", "Flash"])} Sale`,
          `Your exclusive ${brand} offer inside`,
        ]),
        body: `Shop now and save ${discount} on select items.\n\nhttps://${brand.toLowerCase()}.com/sale\n\nUnsubscribe: https://${brand.toLowerCase()}.com/unsub`,
      };
    },
  },
  {
    category: "social",
    weight: 5,
    generate: () => {
      const person = pickName();
      const platforms = [
        { name: "LinkedIn", from: "messages-noreply@linkedin.com", subj: `${person} sent you a message`, body: `"Hey, saw your profile and wanted to connect about an opportunity."` },
        { name: "LinkedIn", from: "messages-noreply@linkedin.com", subj: `${person} endorsed you for ${pick(["TypeScript", "System Design", "Leadership", "Go"])}`, body: "You've been endorsed!" },
        { name: "Twitter/X", from: "notify@x.com", subj: `${person} mentioned you in a post`, body: `"Great thread on distributed systems @you"` },
        { name: "Calendar", from: "calendar-notification@google.com", subj: `Invitation: ${pick(["Coffee chat", "Team sync", "Design review", "Demo day"])} @ ${pick(["10am", "2pm", "4pm"])}`, body: `${person} has invited you to an event.` },
      ];
      const t = pick(platforms);
      return { from: `${t.name} <${t.from}>`, subject: t.subj, body: t.body };
    },
  },
  {
    category: "alerts-monitoring",
    weight: 5,
    generate: () => {
      const services = ["api-gateway", "payment-service", "auth-service", "worker-queue", "cdn-edge"];
      const svc = pick(services);
      const types = [
        { subj: `[ALERT] ${svc}: ${pick(["High error rate", "Latency spike", "CPU > 90%", "Disk space low"])}`, body: `Service: ${svc}\nSeverity: ${pick(["warning", "critical"])}\nTriggered at: ${new Date().toISOString()}` },
        { subj: `[RESOLVED] ${svc} is healthy`, body: `The alert for ${svc} has been resolved. Duration: ${Math.floor(Math.random() * 30 + 2)} minutes.` },
        { subj: `[Datadog] ${svc} — anomaly detected`, body: "An anomaly was detected in your metrics." },
      ];
      const t = pick(types);
      return { from: `Monitoring <alerts@ops.${pickDomain()}>`, subject: t.subj, body: t.body };
    },
  },
  {
    category: "personal",
    weight: 8,
    generate: () => {
      const sender = pickName();
      const topics = [
        { subj: "Dinner Saturday?", body: "Hey! Are you free Saturday evening? Thinking that new Thai place." },
        { subj: "Photos from the trip", body: "Finally uploaded the photos. Link: https://photos.google.com/share/abc123" },
        { subj: "Happy birthday!", body: "Hope you have an amazing day! Let's celebrate soon." },
        { subj: "Book recommendation", body: `Just finished "${pick(["Project Hail Mary", "Tomorrow and Tomorrow", "The Midnight Library", "Klara and the Sun"])}" — you'd love it.` },
        { subj: "Running the half marathon?", body: "Registration closes next week. Want to sign up together?" },
        { subj: "Re: Moving help", body: "I can bring my truck on Sunday. What time works?" },
      ];
      const t = pick(topics);
      return {
        from: `${sender} <${emailAddr(sender, "gmail.com")}>`,
        subject: t.subj,
        body: `${t.body}\n\n- ${sender}`,
      };
    },
  },
];

// --- Build weighted pool ---

function buildPool(): EmailTemplate[] {
  const pool: EmailTemplate[] = [];
  for (const t of templates) {
    for (let i = 0; i < t.weight; i++) pool.push(t);
  }
  return pool;
}

// --- RFC 2822 message builder ---

function buildRawMessage(opts: {
  from: string; to: string; subject: string; body: string; date: Date;
}): string {
  const msg = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Date: ${opts.date.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@seed.test>`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    opts.body,
  ].join("\r\n");

  return Buffer.from(msg)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// --- Main ---

async function main() {
  console.log("Loading OAuth tokens...");
  const raw = await readFile(TOKEN_PATH, "utf-8");
  const tokens = JSON.parse(raw);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
    process.exit(1);
  }

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials(tokens);

  const { token } = await client.getAccessToken();
  if (!token) { console.error("No access token"); process.exit(1); }

  const pool = buildPool();
  const testEmail = "me";
  let inserted = 0;
  let errors = 0;

  console.log(`\nSeeding ${TARGET_COUNT} emails...\n`);

  for (let batch = 0; inserted < TARGET_COUNT; batch++) {
    const batchEmails = [];
    const remaining = TARGET_COUNT - inserted;
    const batchCount = Math.min(BATCH_SIZE, remaining);

    for (let i = 0; i < batchCount; i++) {
      const template = pick(pool);
      const generated = template.generate(inserted + i);
      const date = daysAgo(0, 90);

      const raw = buildRawMessage({
        from: generated.from,
        to: testEmail,
        subject: generated.subject,
        body: generated.body,
        date,
      });

      batchEmails.push({ raw, category: template.category });
    }

    const results = await Promise.allSettled(
      batchEmails.map(async (email) => {
        const res = await fetch(`${BASE}/messages/import`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            raw: email.raw,
            labelIds: ["INBOX", "UNREAD"],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
        return res.json();
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        inserted++;
      } else {
        errors++;
        if (errors <= 3) console.error("  Error:", r.reason.message?.slice(0, 120));
      }
    }

    const pct = Math.floor((inserted / TARGET_COUNT) * 100);
    const bar = "█".repeat(Math.floor(pct / 2)) + "░".repeat(50 - Math.floor(pct / 2));
    process.stdout.write(`\r  [${bar}] ${inserted}/${TARGET_COUNT} (${pct}%) — errors: ${errors}`);

    if (inserted < TARGET_COUNT) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`\n\nDone! Inserted ${inserted} emails (${errors} errors).`);
  console.log("\nBreakdown by category (approximate):");
  for (const t of templates) {
    const approx = Math.round((t.weight / templates.reduce((s, t2) => s + t2.weight, 0)) * TARGET_COUNT);
    console.log(`  ${t.category.padEnd(20)} ~${approx}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
