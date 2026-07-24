import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { ResellerRecord } from "../../lib/reseller";
import { LicenseRecord } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const { resellerKey, cascade = true, reason = "" } = req.body || {};
  if (!resellerKey) return res.status(400).json({ error: "resellerKey is required" });

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });

  const reseller = await redis.get<ResellerRecord>(`reseller:${resellerKey}`);
  if (!reseller) return res.status(404).json({ error: "Reseller not found" });

  await redis.set(`reseller:${resellerKey}`, { ...reseller, active: false });

  let deactivatedLicenses = 0;
  if (cascade) {
    const licenseKeys: string[] = await redis.smembers(`reseller_licenses:${resellerKey}`);
    await Promise.all(licenseKeys.map(async (key) => {
      const record = await redis.get<LicenseRecord>(`license:${key}`);
      if (record && record.active !== false) {
        await redis.set(`license:${key}`, { ...record, active: false });
        deactivatedLicenses++;
      }
    }));
  }

  return res.status(200).json({
    resellerKey,
    status: "deactivated",
    cascade,
    deactivatedLicenses,
    reason,
  });
}
