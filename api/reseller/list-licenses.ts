import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateResellerKey, getRedis } from "../../lib/reseller";
import { LicenseRecord } from "../../lib/license";

function daysRemaining(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const resellerKey = String(req.headers["x-reseller-key"] || "").trim();
  const auth = await validateResellerKey(resellerKey);
  if (!auth.valid) return res.status(401).json({ error: auth.reason });

  const redis  = getRedis();
  const keys: string[] = await redis.smembers(`reseller_licenses:${resellerKey}`);

  const licenses = await Promise.all(
    keys.map(async (key) => {
      const record = await redis.get<LicenseRecord>(`license:${key}`);
      if (!record) return null;

      const expired = !!(record.expiresAt && new Date(record.expiresAt) < new Date());
      const days    = record.expiresAt ? daysRemaining(record.expiresAt) : null;

      return {
        key,
        label:         record.label         || "",
        contactEmail:  record.contactEmail  || "",
        scope:         record.scope,
        type:          record.type,
        tier:          record.tier          || "",
        allowedEmail:  record.allowedEmail  || "",
        allowedDomains: record.allowedDomains || (record.allowedDomain ? [record.allowedDomain] : []),
        maxUsers:      record.maxUsers      ?? 0,
        createdAt:     record.createdAt,
        expiresAt:     record.expiresAt,
        daysRemaining: days,
        status:        expired ? "expired" : "active",
      };
    })
  );

  const result = licenses
    .filter(Boolean)
    .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

  return res.status(200).json({ reseller: auth.reseller!.name, count: result.length, licenses: result });
}
