import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { validateResellerKey, getRedis } from "../../lib/reseller";
import { generateKey, LicenseRecord, TIERS } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const resellerKey = String(req.headers["x-reseller-key"] || "").trim();
  const auth = await validateResellerKey(resellerKey);
  if (!auth.valid) return res.status(401).json({ error: auth.reason });

  const body          = req.body || {};
  const type          = String(body.type  || "paid") as "trial" | "paid";
  const scope         = String(body.scope || "org")  as "user" | "org";
  const trialDays     = Number(body.trialDays ?? 30);
  const tier          = String(body.tier  || "");
  const allowedEmail  = String(body.allowedEmail  || "");
  const label         = String(body.label         || "");
  const contactEmail  = String(body.contactEmail  || "");

  const rawDomains    = body.allowedDomains ?? body.allowedDomain ?? [];
  const allowedDomains: string[] = (Array.isArray(rawDomains) ? rawDomains : [rawDomains])
    .map((d: string) => String(d).toLowerCase().trim())
    .filter(Boolean);

  const maxUsers: number = body.maxUsers != null
    ? Number(body.maxUsers)
    : (TIERS[tier]?.maxUsers ?? 0);

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

  const redis: Redis = getRedis();

  // Enforce license cap if set
  const maxLicenses = auth.reseller!.maxLicenses ?? 0;
  if (maxLicenses > 0) {
    const currentCount = await redis.scard(`reseller_licenses:${resellerKey}`);
    if (currentCount >= maxLicenses) {
      return res.status(403).json({ error: `License limit (${maxLicenses}) reached for your account. Contact support to increase your limit.` });
    }
  }

  const key = generateKey();
  const now          = new Date();

  const record: LicenseRecord = {
    type,
    scope,
    createdAt:  now.toISOString(),
    expiresAt:  type === "trial"
      ? new Date(now.getTime() + trialDays * 86_400_000).toISOString()
      : null,
    resellerId: resellerKey,
  };

  if (scope === "user") { record.allowedEmail   = allowedEmail.toLowerCase().trim(); }
  if (scope === "org")  { record.allowedDomains = allowedDomains; record.maxUsers = maxUsers; }
  if (tier)             { record.tier           = tier; }
  if (label)            { record.label          = label; }
  if (contactEmail)     { record.contactEmail   = contactEmail; }

  await redis.set(`license:${key}`, record);
  await redis.sadd(`reseller_licenses:${resellerKey}`, key);
  await redis.sadd("all_licenses", key);
  if (scope === "user" && record.allowedEmail) {
    await redis.set(`email_license:${record.allowedEmail}`, key);
  }

  if (scope === "org") {
    for (const domain of allowedDomains) {
      await redis.sadd(`org_domain:${domain}`, key);
    }
  }

  return res.status(200).json({ key, ...record });
}
