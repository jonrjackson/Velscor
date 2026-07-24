import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { generateKey, LicenseRecord, TIERS } from "../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const providedSecret = String(req.headers["x-admin-secret"] || "").trim();
  const expectedSecret = (process.env.ADMIN_SECRET || "").trim();
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  const type          = String(body.type         || "trial") as "trial" | "paid";
  const scope         = String(body.scope        || "user") as "user" | "org";
  const trialDays     = Number(body.trialDays    ?? 30);
  const tier          = String(body.tier         || "");
  const allowedEmail  = String(body.allowedEmail || "");
  // Accept allowedDomains (array) or allowedDomain (string) — always store as array
  const rawDomains = body.allowedDomains ?? body.allowedDomain ?? [];
  const allowedDomains: string[] = (Array.isArray(rawDomains) ? rawDomains : [rawDomains])
    .map((d: string) => String(d).toLowerCase().trim())
    .filter(Boolean);
  const maxUsers      = body.maxUsers != null ? Number(body.maxUsers) : (TIERS[tier]?.maxUsers ?? 0);
  const label         = String(body.label        || "");
  const contactEmail  = String(body.contactEmail || "");
  const discountPct   = Number(body.discountPct  || 0);
  const discountNote  = String(body.discountNote || "");

  if (!["trial", "paid"].includes(type)) {
    return res.status(400).json({ error: "type must be 'trial' or 'paid'" });
  }
  if (!["user", "org"].includes(scope)) {
    return res.status(400).json({ error: "scope must be 'user' or 'org'" });
  }
  if (scope === "user" && !allowedEmail) {
    return res.status(400).json({ error: "allowedEmail is required for user scope" });
  }
  if (scope === "org" && allowedDomains.length === 0) {
    return res.status(400).json({ error: "allowedDomain or allowedDomains is required for org scope" });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const key = generateKey();
  const now = new Date();

  const record: LicenseRecord = {
    type,
    scope,
    createdAt: now.toISOString(),
    expiresAt: type === "trial"
      ? new Date(now.getTime() + Number(trialDays) * 86_400_000).toISOString()
      : null,
  };

  if (scope === "user") { record.allowedEmail   = allowedEmail.toLowerCase().trim(); }
  if (scope === "org")  { record.allowedDomains = allowedDomains; record.maxUsers = Number(maxUsers); }
  if (tier)              { record.tier          = tier; }
  if (label)             { record.label         = label; }
  if (contactEmail)      { record.contactEmail  = contactEmail; }
  if (discountPct)       { record.discountPct   = Number(discountPct); }
  if (discountNote)      { record.discountNote  = discountNote; }

  await redis.set(`license:${key}`, record);
  await redis.sadd("all_licenses", key);

  if (scope === "org") {
    for (const domain of allowedDomains) {
      await redis.sadd(`org_domain:${domain}`, key);
    }
  }
  if (scope === "user" && record.allowedEmail) {
    await redis.set(`email_license:${record.allowedEmail}`, key);
  }

  return res.status(200).json({ key, ...record });
}
