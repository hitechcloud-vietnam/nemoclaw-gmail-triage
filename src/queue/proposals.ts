import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { Proposal, NewProposal, AuditEntry } from "./types.js";

const DATA_DIR = join(homedir(), ".openclaw-data", "gmail-triage");
const PROPOSALS_PATH = join(DATA_DIR, "proposals.json");
const AUDIT_PATH = join(DATA_DIR, "audit.jsonl");

async function ensureDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function loadProposals(): Promise<Proposal[]> {
  try {
    const raw = await readFile(PROPOSALS_PATH, "utf-8");
    return JSON.parse(raw) as Proposal[];
  } catch {
    return [];
  }
}

export async function saveProposals(proposals: Proposal[]): Promise<void> {
  await ensureDir();
  await writeFile(PROPOSALS_PATH, JSON.stringify(proposals, null, 2), "utf-8");
}

export async function addProposal(proposal: NewProposal): Promise<Proposal> {
  const proposals = await loadProposals();
  const full: Proposal = {
    ...proposal,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  } as Proposal;
  proposals.push(full);
  await saveProposals(proposals);
  return full;
}

export async function removeProposal(id: string): Promise<Proposal | null> {
  const proposals = await loadProposals();
  const idx = proposals.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const [removed] = proposals.splice(idx, 1);
  await saveProposals(proposals);
  return removed;
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const proposals = await loadProposals();
  return proposals.find((p) => p.id === id) ?? null;
}

export async function appendAudit(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
  await ensureDir();
  const full: AuditEntry = { ...entry, timestamp: new Date().toISOString() };
  const line = JSON.stringify(full) + "\n";
  const { appendFile } = await import("node:fs/promises");
  await appendFile(AUDIT_PATH, line, "utf-8");
}

export async function readAudit(limit = 50): Promise<AuditEntry[]> {
  try {
    const raw = await readFile(AUDIT_PATH, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as AuditEntry)
      .reverse();
  } catch {
    return [];
  }
}
