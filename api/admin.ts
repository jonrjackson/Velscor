import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import {
  ActionError,
  createLicense, updateLicense, deactivateLicense, deleteLicense, rotateKey,
  listLicenses, lookupLicense, billingReport,
  createReseller, updateReseller, deactivateReseller, listResellers,
} from "../lib/admin-actions";

function checkAuth(req: VercelRequest): boolean {
  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  return !!(expected && provided === expected);
}

function redis(): Redis {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

const ACTIONS: Record<string, (body: any, db: Redis) => Promise<unknown>> = {
  "create-license":      createLicense,
  "update-license":      updateLicense,
  "deactivate-license":  deactivateLicense,
  "delete-license":      deleteLicense,
  "rotate-key":          rotateKey,
  "list-licenses":       (_body, db) => listLicenses(db),
  "lookup-license":      lookupLicense,
  "billing-report":      (_body, db) => billingReport(db),
  "create-reseller":     createReseller,
  "update-reseller":     updateReseller,
  "deactivate-reseller": deactivateReseller,
  "list-resellers":      (_body, db) => listResellers(db),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const db     = redis();
  const body   = req.body || {};
  const action = String(body.action || "");

  const fn = ACTIONS[action];
  if (!fn) {
    return res.status(400).json({ error: `Unknown action: ${action}`, available: Object.keys(ACTIONS) });
  }

  try {
    const result = await fn(body, db);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ActionError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}
