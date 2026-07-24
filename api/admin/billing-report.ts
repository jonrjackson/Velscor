import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { ResellerRecord } from "../../lib/reseller";
import { LicenseRecord } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });

  const resellerKeys: string[] = await redis.smembers("all_resellers");
  const allLicenseKeys: string[] = await redis.smembers("all_licenses");

  // Build set of reseller-owned license keys for exclusion from direct count
  const resellerOwnedKeys = new Set<string>();

  const resellers = await Promise.all(resellerKeys.map(async (rKey) => {
    const reseller = await redis.get<ResellerRecord>(`reseller:${rKey}`);
    if (!reseller) return null;

    const licKeys: string[] = await redis.smembers(`reseller_licenses:${rKey}`);
    licKeys.forEach(k => resellerOwnedKeys.add(k));

    const licenses = await Promise.all(licKeys.map(k => redis.get<LicenseRecord>(`license:${k}`)));
    const active  = licenses.filter(r => r && r.active !== false && (!r.expiresAt || new Date(r.expiresAt) > new Date())).length;
    const expired = licenses.filter(r => r && r.active !== false && r.expiresAt && new Date(r.expiresAt) <= new Date()).length;

    return { resellerKey: rKey, name: reseller.name, email: reseller.email,
             discountPct: reseller.discountPct, active: reseller.active,
             totalLicenses: licKeys.length, activeLicenses: active, expiredLicenses: expired };
  }));

  // Direct licenses (not through a reseller)
  const directKeys = allLicenseKeys.filter(k => !resellerOwnedKeys.has(k));
  const directLicenses = await Promise.all(directKeys.map(k => redis.get<LicenseRecord>(`license:${k}`)));
  const directActive  = directLicenses.filter(r => r && r.active !== false && (!r.expiresAt || new Date(r.expiresAt) > new Date())).length;
  const directExpired = directLicenses.filter(r => r && r.active !== false && r.expiresAt && new Date(r.expiresAt) <= new Date()).length;

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    resellers: resellers.filter(Boolean).sort((a, b) => (b!.activeLicenses - a!.activeLicenses)),
    direct: { totalLicenses: directKeys.length, activeLicenses: directActive, expiredLicenses: directExpired },
  });
}
