import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { validateResellerKey } from "../lib/reseller";
import { generateKey, LicenseRecord, TIERS } from "../lib/license";

function redis(): Redis {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

function daysRemaining(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

// ── Action handlers ──────────────────────────────────────────────────────────

async function createLicense(body: any, resellerKey: string, resellerName: string, maxLicenses: number, db: Redis, res: VercelResponse) {
  const type          = String(body.type  || "paid") as "trial" | "paid";
  const scope         = String(body.scope || "org")  as "user" | "org";
  const trialDays     = Number(body.trialDays ?? 30);
  const tier          = String(body.tier         || "");
  const allowedEmail  = String(body.allowedEmail  || "");
  const label         = String(body.label         || "");
  const contactEmail  = String(body.contactEmail  || "");

  const rawDomains     = body.allowedDomains ?? body.allowedDomain ?? [];
  const allowedDomains: string[] = (Array.isArray(rawDomains) ? rawDomains : [rawDomains])
    .map((d: string) => String(d).toLowerCase().trim()).filter(Boolean);
  const maxUsers: number = body.maxUsers != null ? Number(body.maxUsers) : (TIERS[tier]?.maxUsers ?? 0);

  if (!["trial", "paid"].includes(type)) return res.status(400).json({ error: "type must be 'trial' or 'paid'" });
  if (!["user", "org"].includes(scope))  return res.status(400).json({ error: "scope must be 'user' or 'org'" });
  if (scope === "user" && !allowedEmail)          return res.status(400).json({ error: "allowedEmail required for user scope" });
  if (scope === "org"  && !allowedDomains.length) return res.status(400).json({ error: "allowedDomain(s) required for org scope" });

  // Enforce license cap
  if (maxLicenses > 0) {
    const count = await db.scard(`reseller_licenses:${resellerKey}`);
    if (count >= maxLicenses) {
      return res.status(403).json({ error: `License limit (${maxLicenses}) reached. Contact support to increase your limit.` });
    }
  }

  const key = generateKey();
  const now = new Date();
  const record: LicenseRecord = {
    type, scope,
    createdAt: now.toISOString(),
    expiresAt: type === "trial" ? new Date(now.getTime() + trialDays * 86_400_000).toISOString() : null,
    resellerId: resellerKey,
  };
  if (scope === "user") { record.allowedEmail   = allowedEmail.toLowerCase().trim(); }
  if (scope === "org")  { record.allowedDomains = allowedDomains; record.maxUsers = maxUsers; }
  if (tier)         record.tier         = tier;
  if (label)        record.label        = label;
  if (contactEmail) record.contactEmail = contactEmail;

  await db.set(`license:${key}`, record);
  await db.sadd(`reseller_licenses:${resellerKey}`, key);
  await db.sadd("all_licenses", key);
  if (scope === "org")  for (const d of allowedDomains) await db.sadd(`org_domain:${d}`, key);
  if (scope === "user" && record.allowedEmail) await db.set(`email_license:${record.allowedEmail}`, key);

  return res.status(200).json({ key, ...record });
}

async function listLicenses(resellerKey: string, resellerName: string, db: Redis, res: VercelResponse) {
  const keys: string[] = await db.smembers(`reseller_licenses:${resellerKey}`);
  const licenses = (await Promise.all(keys.map(async (key) => {
    const r = await db.get<LicenseRecord>(`license:${key}`);
    if (!r) return null;
    const expired = !!(r.expiresAt && new Date(r.expiresAt) < new Date());
    return {
      key, label: r.label || "", contactEmail: r.contactEmail || "",
      scope: r.scope, type: r.type, tier: r.tier || "",
      allowedEmail: r.allowedEmail || "",
      allowedDomains: r.allowedDomains || (r.allowedDomain ? [r.allowedDomain] : []),
      maxUsers: r.maxUsers ?? 0, createdAt: r.createdAt, expiresAt: r.expiresAt,
      daysRemaining: r.expiresAt ? daysRemaining(r.expiresAt) : null,
      status: r.active === false ? "deactivated" : expired ? "expired" : "active",
    };
  }))).filter(Boolean).sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

  return res.status(200).json({ reseller: resellerName, count: licenses.length, licenses });
}

async function updateLicense(body: any, resellerKey: string, db: Redis, res: VercelResponse) {
  const key = String(body.key || "").trim();
  if (!key) return res.status(400).json({ error: "key is required" });

  const owned = await db.sismember(`reseller_licenses:${resellerKey}`, key);
  if (!owned) return res.status(403).json({ error: "License not found in your account" });

  const existing = await db.get<LicenseRecord>(`license:${key}`);
  if (!existing) return res.status(404).json({ error: "License not found" });

  const updated: LicenseRecord = { ...existing };
  if (body.type !== undefined) {
    const newType = String(body.type) as "trial" | "paid";
    if (!["trial", "paid"].includes(newType)) return res.status(400).json({ error: "type must be 'trial' or 'paid'" });
    updated.type = newType;
    if (newType === "paid") updated.expiresAt = null;
  }
  if (body.tier        !== undefined) { updated.tier = String(body.tier); if (body.maxUsers === undefined && TIERS[updated.tier]) updated.maxUsers = TIERS[updated.tier].maxUsers; }
  if (body.maxUsers    !== undefined) updated.maxUsers    = Number(body.maxUsers);
  if (body.expiresAt   !== undefined) updated.expiresAt   = body.expiresAt || null;
  if (body.label       !== undefined) updated.label       = String(body.label);
  if (body.contactEmail !== undefined) updated.contactEmail = String(body.contactEmail);
  if (body.allowedDomains !== undefined) {
    const raw = Array.isArray(body.allowedDomains) ? body.allowedDomains : [body.allowedDomains];
    updated.allowedDomains = raw.map((d: string) => String(d).toLowerCase().trim()).filter(Boolean);
    delete updated.allowedDomain;
    for (const d of updated.allowedDomains) await db.sadd(`org_domain:${d}`, key);
  }
  if (body.allowedEmail !== undefined) updated.allowedEmail = String(body.allowedEmail).toLowerCase().trim();

  await db.set(`license:${key}`, updated);
  return res.status(200).json({ key, ...updated });
}

// ── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const resellerKey = String(req.headers["x-reseller-key"] || "").trim();
  const auth = await validateResellerKey(resellerKey);
  if (!auth.valid) return res.status(401).json({ error: auth.reason });

  const db     = redis();
  const body   = req.body || {};
  const action = String(body.action || "");
  const name   = auth.reseller!.name;
  const cap    = auth.reseller!.maxLicenses ?? 0;

  switch (action) {
    case "create-license": return createLicense(body, resellerKey, name, cap, db, res);
    case "list-licenses":  return listLicenses(resellerKey, name, db, res);
    case "update-license": return updateLicense(body, resellerKey, db, res);
    default: return res.status(400).json({ error: `Unknown action: ${action}`, available: ["create-license", "list-licenses", "update-license"] });
  }
}
