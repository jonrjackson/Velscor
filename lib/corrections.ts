import { Redis } from "@upstash/redis";
import { ActionError } from "./admin-actions";

export type Verdict = "SAFE" | "SUSPICIOUS" | "SPAM";
export type CorrectionStatus = "pending" | "approved";

export interface Correction {
  id: string;
  createdAt: string;
  status: CorrectionStatus;
  senderDisplay?: string;
  senderEmail?: string;
  subject?: string;
  authResults?: string;
  returnPath?: string;
  replyTo?: string;
  bodyExcerpt?: string;
  originalVerdict: Verdict;
  // What the analyzer itself said, captured at report time — the actual
  // reasoning/flags, not just the verdict label, so a wrong call can be
  // diagnosed without reverse-engineering it from the prompt.
  originalSummary?: string;
  originalFlags?: string[];
  correctedVerdict: Verdict;
  lesson: string;
  // Present only on user-reported (pending) corrections.
  reporterNote?: string;
  reporterEmail?: string;
}

const ALL_IDS_KEY = "all_correction_ids";
const MAX_APPROVED_IN_PROMPT = 20;

const VERDICTS: Verdict[] = ["SAFE", "SUSPICIOUS", "SPAM"];

function correctionKey(id: string): string {
  return `correction:${id}`;
}

function requireVerdict(value: unknown, field: string): Verdict {
  const v = String(value || "");
  if (!VERDICTS.includes(v as Verdict)) throw new ActionError(400, `${field} must be SAFE, SUSPICIOUS, or SPAM`);
  return v as Verdict;
}

// Accepts a real array (JSON body) or a comma-separated string (form field).
function parseList(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw) ? raw : String(raw).split(",");
  const items = list.map((s) => String(s).trim()).filter(Boolean);
  return items.length ? items : undefined;
}

// Admin-authored corrections are trusted immediately — approved on creation.
export async function addCorrection(body: any, db: Redis): Promise<Correction> {
  const originalVerdict = requireVerdict(body.originalVerdict, "originalVerdict");
  const correctedVerdict = requireVerdict(body.correctedVerdict, "correctedVerdict");
  const lesson = String(body.lesson || "").trim();
  if (!lesson) throw new ActionError(400, "lesson is required — explain why the verdict should change");

  const record: Correction = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "approved",
    senderDisplay: String(body.senderDisplay || "").trim() || undefined,
    senderEmail: String(body.senderEmail || "").trim() || undefined,
    subject: String(body.subject || "").trim() || undefined,
    authResults: String(body.authResults || "").trim() || undefined,
    returnPath: String(body.returnPath || "").trim() || undefined,
    replyTo: String(body.replyTo || "").trim() || undefined,
    bodyExcerpt: String(body.bodyExcerpt || "").trim().slice(0, 500) || undefined,
    originalVerdict,
    correctedVerdict,
    lesson,
  };

  await db.set(correctionKey(record.id), record);
  await db.sadd(ALL_IDS_KEY, record.id);
  return record;
}

// End-user-reported corrections (from the add-in) start as "pending" and
// don't feed the prompt until an admin reviews and approves them.
export async function reportCorrection(body: any, db: Redis): Promise<Correction> {
  const originalVerdict = requireVerdict(body.originalVerdict, "originalVerdict");
  const correctedVerdict = requireVerdict(body.correctedVerdict, "correctedVerdict");

  const record: Correction = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    senderDisplay: String(body.senderDisplay || "").trim() || undefined,
    senderEmail: String(body.senderEmail || "").trim() || undefined,
    subject: String(body.subject || "").trim() || undefined,
    authResults: String(body.authResults || "").trim() || undefined,
    returnPath: String(body.returnPath || "").trim() || undefined,
    replyTo: String(body.replyTo || "").trim() || undefined,
    bodyExcerpt: String(body.bodyExcerpt || "").trim().slice(0, 500) || undefined,
    originalVerdict,
    originalSummary: String(body.originalSummary || "").trim() || undefined,
    originalFlags: parseList(body.originalFlags),
    correctedVerdict,
    lesson: "",
    reporterNote: String(body.reporterNote || "").trim().slice(0, 1000) || undefined,
    reporterEmail: String(body.reporterEmail || "").trim() || undefined,
  };

  await db.set(correctionKey(record.id), record);
  await db.sadd(ALL_IDS_KEY, record.id);
  return record;
}

export async function getCorrection(id: string, db: Redis): Promise<Correction | null> {
  return db.get<Correction>(correctionKey(id));
}

export async function listCorrections(db: Redis): Promise<Correction[]> {
  const ids: string[] = await db.smembers(ALL_IDS_KEY);
  const all = await Promise.all(ids.map((id) => db.get<Correction>(correctionKey(id))));
  return all
    .filter((c): c is Correction => !!c)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Approve a pending correction, optionally editing any field first (an admin
// should almost always tighten the lesson text before it goes live).
export async function approveCorrection(id: string, body: any, db: Redis): Promise<Correction> {
  const existing = await getCorrection(id, db);
  if (!existing) throw new ActionError(404, "Correction not found");

  const updated: Correction = {
    ...existing,
    status: "approved",
    senderDisplay: body.senderDisplay !== undefined ? String(body.senderDisplay).trim() || undefined : existing.senderDisplay,
    senderEmail: body.senderEmail !== undefined ? String(body.senderEmail).trim() || undefined : existing.senderEmail,
    subject: body.subject !== undefined ? String(body.subject).trim() || undefined : existing.subject,
    authResults: body.authResults !== undefined ? String(body.authResults).trim() || undefined : existing.authResults,
    returnPath: body.returnPath !== undefined ? String(body.returnPath).trim() || undefined : existing.returnPath,
    replyTo: body.replyTo !== undefined ? String(body.replyTo).trim() || undefined : existing.replyTo,
    bodyExcerpt: body.bodyExcerpt !== undefined ? String(body.bodyExcerpt).trim().slice(0, 500) || undefined : existing.bodyExcerpt,
    originalVerdict: body.originalVerdict !== undefined ? requireVerdict(body.originalVerdict, "originalVerdict") : existing.originalVerdict,
    originalSummary: body.originalSummary !== undefined ? String(body.originalSummary).trim() || undefined : existing.originalSummary,
    originalFlags: body.originalFlags !== undefined ? parseList(body.originalFlags) : existing.originalFlags,
    correctedVerdict: body.correctedVerdict !== undefined ? requireVerdict(body.correctedVerdict, "correctedVerdict") : existing.correctedVerdict,
    lesson: body.lesson !== undefined ? String(body.lesson).trim() : existing.lesson,
  };
  if (!updated.lesson) throw new ActionError(400, "lesson is required before approving");

  await db.set(correctionKey(id), updated);
  return updated;
}

// Save edits to an already-approved correction without changing its status.
export async function updateCorrection(id: string, body: any, db: Redis): Promise<Correction> {
  const existing = await getCorrection(id, db);
  if (!existing) throw new ActionError(404, "Correction not found");
  const lesson = body.lesson !== undefined ? String(body.lesson).trim() : existing.lesson;
  if (!lesson) throw new ActionError(400, "lesson is required");

  const updated: Correction = {
    ...existing,
    senderDisplay: body.senderDisplay !== undefined ? String(body.senderDisplay).trim() || undefined : existing.senderDisplay,
    senderEmail: body.senderEmail !== undefined ? String(body.senderEmail).trim() || undefined : existing.senderEmail,
    subject: body.subject !== undefined ? String(body.subject).trim() || undefined : existing.subject,
    authResults: body.authResults !== undefined ? String(body.authResults).trim() || undefined : existing.authResults,
    returnPath: body.returnPath !== undefined ? String(body.returnPath).trim() || undefined : existing.returnPath,
    replyTo: body.replyTo !== undefined ? String(body.replyTo).trim() || undefined : existing.replyTo,
    bodyExcerpt: body.bodyExcerpt !== undefined ? String(body.bodyExcerpt).trim().slice(0, 500) || undefined : existing.bodyExcerpt,
    originalVerdict: body.originalVerdict !== undefined ? requireVerdict(body.originalVerdict, "originalVerdict") : existing.originalVerdict,
    originalSummary: body.originalSummary !== undefined ? String(body.originalSummary).trim() || undefined : existing.originalSummary,
    originalFlags: body.originalFlags !== undefined ? parseList(body.originalFlags) : existing.originalFlags,
    correctedVerdict: body.correctedVerdict !== undefined ? requireVerdict(body.correctedVerdict, "correctedVerdict") : existing.correctedVerdict,
    lesson,
  };
  await db.set(correctionKey(id), updated);
  return updated;
}

export async function deleteCorrection(id: string, db: Redis): Promise<void> {
  const existing = await getCorrection(id, db);
  if (!existing) throw new ActionError(404, "Correction not found");
  await db.del(correctionKey(id));
  await db.srem(ALL_IDS_KEY, id);
}

// Isolated on purpose: today this just returns the most recent approved
// corrections, but this is the seam where a future upgrade (e.g. semantic
// similarity search over `currentEmail` via a vector index) can slot in
// without changing any caller — analyze.ts only ever calls this function.
export async function getRelevantCorrections(
  db: Redis,
  _currentEmail?: { sender?: string; senderEmail?: string; subject?: string; authResults?: string; body?: string }
): Promise<Correction[]> {
  const all = await listCorrections(db);
  return all.filter((c) => c.status === "approved").slice(0, MAX_APPROVED_IN_PROMPT);
}

export function formatCorrectionsForPrompt(corrections: Correction[]): string {
  if (corrections.length === 0) return "";
  const examples = corrections
    .map((c, i) => {
      const parts = [
        `${i + 1}. Sender: ${c.senderDisplay || "?"} <${c.senderEmail || "?"}>`,
        c.subject ? `Subject: "${c.subject}"` : null,
        c.authResults ? `Auth: ${c.authResults}` : null,
        c.returnPath ? `Return-Path: ${c.returnPath}` : null,
        c.replyTo ? `Reply-To: ${c.replyTo}` : null,
        `Previous verdict was ${c.originalVerdict}, but the correct verdict is ${c.correctedVerdict}.`,
        c.originalSummary ? `Originally reasoned (incorrectly): ${c.originalSummary}${c.originalFlags?.length ? ` [flags: ${c.originalFlags.join(", ")}]` : ""}` : null,
        `Lesson: ${c.lesson}`,
      ].filter(Boolean);
      return parts.join(" ");
    })
    .join("\n");
  return `\n\nPast corrections — real cases where a previous analysis got it wrong, and the lesson learned from each. Apply these lessons to similar situations, not just exact matches:\n${examples}`;
}
