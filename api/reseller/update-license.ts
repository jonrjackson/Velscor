import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateResellerKey, getRedis } from "../../lib/reseller";
import { LicenseRecord, TIERS } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const resellerKey = String(req.headers["x-reseller-key"] || "").trim();
  const auth = await validateResellerKey(resellerKey);
  if (!auth.valid) return res.status(401).json({ error: auth.reason });

  const body = req.body || {};
  const key  = String(body.key || "").trim();
  if (!key) return res.status(400).json({ error: "key is required" });

  const redis = getRedis();

  // Verify this license belongs to this reseller
  const owned = await redis.sismember(`reseller_licenses:${resellerKey}`, key);
  if (!owned) return res.status(403).json({ error: "License not found in your account" });

  const existing = await redis.get<LicenseRecord>(`license:${key}`);
  if (!existing) return res.status(404).json({ error: "License key not found" });

  const updated: LicenseRecord = { ...existing };

  // Resellers can convert trial → paid, upgrade tier, extend expiry, update domains/labels
  if (body.type !== undefined) {
    const newType = String(body.type) as "trial" | "paid";
    if (!["trial", "paid"].includes(newType)) {
      return res.status(400).json({ error: "type must be 'trial' or 'paid'" });
    }
    updated.type = newType;
    if (newType === "paid") updated.expiresAt = null; // paid licenses don't expire
  }
  if (body.tier !== undefined) {
    updated.tier = String(body.tier);
    if (body.maxUsers === undefined && TIERS[updated.tier]) {
      updated.maxUsers = TIERS[updated.tier].maxUsers;
    }
  }
  if (body.maxUsers    !== undefined) updated.maxUsers    = Number(body.maxUsers);
  if (body.expiresAt   !== undefined) updated.expiresAt   = body.expiresAt || null;
  if (body.label       !== undefined) updated.label       = String(body.label);
  if (body.contactEmail !== undefined) updated.contactEmail = String(body.contactEmail);

  if (body.allowedDomains !== undefined) {
    const raw = Array.isArray(body.allowedDomains) ? body.allowedDomains : [body.allowedDomains];
    updated.allowedDomains = raw.map((d: string) => String(d).toLowerCase().trim()).filter(Boolean);
    delete updated.allowedDomain;

    // Update domain index for new domains
    for (const domain of updated.allowedDomains) {
      await redis.sadd(`org_domain:${domain}`, key);
    }
  }
  if (body.allowedEmail !== undefined) {
    updated.allowedEmail = String(body.allowedEmail).toLowerCase().trim();
  }

  await redis.set(`license:${key}`, updated);

  return res.status(200).json({ key, ...updated });
}
