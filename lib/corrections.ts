import { Redis } from "@upstash/redis";
import { ActionError } from "./admin-actions";

export type Verdict = "SAFE" | "SUSPICIOUS" | "SPAM";

export interface Correction {
  id: string;
  createdAt: string;
  senderDisplay?: string;
  senderEmail?: string;
  subject?: string;
  authResults?: string;
  bodyExcerpt?: string;
  originalVerdict: Verdict;
  correctedVerdict: Verdict;
  lesson: string;
}

const CORRECTIONS_KEY = "analysis_corrections";
const MAX_CORRECTIONS = 20;

const VERDICTS: Verdict[] = ["SAFE", "SUSPICIOUS", "SPAM"];

export async function addCorrection(body: any, db: Redis): Promise<Correction> {
  const originalVerdict = String(body.originalVerdict || "");
  const correctedVerdict = String(body.correctedVerdict || "");
  const lesson = String(body.lesson || "").trim();
  if (!VERDICTS.includes(originalVerdict as Verdict)) throw new ActionError(400, "originalVerdict must be SAFE, SUSPICIOUS, or SPAM");
  if (!VERDICTS.includes(correctedVerdict as Verdict)) throw new ActionError(400, "correctedVerdict must be SAFE, SUSPICIOUS, or SPAM");
  if (!lesson) throw new ActionError(400, "lesson is required — explain why the verdict should change");

  const record: Correction = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    senderDisplay: String(body.senderDisplay || "").trim() || undefined,
    senderEmail: String(body.senderEmail || "").trim() || undefined,
    subject: String(body.subject || "").trim() || undefined,
    authResults: String(body.authResults || "").trim() || undefined,
    bodyExcerpt: String(body.bodyExcerpt || "").trim().slice(0, 500) || undefined,
    originalVerdict: originalVerdict as Verdict,
    correctedVerdict: correctedVerdict as Verdict,
    lesson,
  };

  await db.lpush(CORRECTIONS_KEY, JSON.stringify(record));
  await db.ltrim(CORRECTIONS_KEY, 0, MAX_CORRECTIONS - 1);
  return record;
}

export async function listCorrections(db: Redis): Promise<Correction[]> {
  const raw = await db.lrange(CORRECTIONS_KEY, 0, -1);
  return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r)).filter(Boolean);
}

export async function deleteCorrection(id: string, db: Redis): Promise<void> {
  const all = await listCorrections(db);
  const remaining = all.filter((c) => c.id !== id);
  if (remaining.length === all.length) throw new ActionError(404, "Correction not found");
  await db.del(CORRECTIONS_KEY);
  if (remaining.length > 0) {
    // lpush prepends, so push in reverse to preserve original (newest-first) order.
    await db.lpush(CORRECTIONS_KEY, ...remaining.slice().reverse().map((c) => JSON.stringify(c)));
  }
}

// Isolated on purpose: today this just returns the full capped correction
// log, but this is the seam where a future upgrade (e.g. semantic similarity
// search over `currentEmail` via a vector index) can slot in without
// changing any caller — analyze.ts only ever calls this one function.
export async function getRelevantCorrections(
  db: Redis,
  _currentEmail?: { sender?: string; senderEmail?: string; subject?: string; authResults?: string; body?: string }
): Promise<Correction[]> {
  return listCorrections(db);
}

export function formatCorrectionsForPrompt(corrections: Correction[]): string {
  if (corrections.length === 0) return "";
  const examples = corrections
    .map((c, i) => {
      const parts = [
        `${i + 1}. Sender: ${c.senderDisplay || "?"} <${c.senderEmail || "?"}>`,
        c.subject ? `Subject: "${c.subject}"` : null,
        c.authResults ? `Auth: ${c.authResults}` : null,
        `Previous verdict was ${c.originalVerdict}, but the correct verdict is ${c.correctedVerdict}.`,
        `Lesson: ${c.lesson}`,
      ].filter(Boolean);
      return parts.join(" ");
    })
    .join("\n");
  return `\n\nPast corrections — real cases where a previous analysis got it wrong, and the lesson learned from each. Apply these lessons to similar situations, not just exact matches:\n${examples}`;
}
