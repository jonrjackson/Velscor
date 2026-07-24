import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { LicenseRecord } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const { key } = req.body || {};
  if (!key) return res.status(400).json({ error: "key is required" });

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
  const record = await redis.get<LicenseRecord>(`license:${key}`);
  if (!record) return res.status(404).json({ error: "License not found" });

  // Remove from all indexes
  await redis.del(`license:${key}`);
  await redis.srem("all_licenses", key);

  if (record.resellerId) {
    await redis.srem(`reseller_licenses:${record.resellerId}`, key);
  }
  if (record.allowedEmail) {
    await redis.del(`email_license:${record.allowedEmail}`);
  }
  const domains = record.allowedDomains || (record.allowedDomain ? [record.allowedDomain] : []);
  for (const domain of domains) {
    await redis.srem(`org_domain:${domain}`, key);
  }

  return res.status(200).json({ key, deleted: true });
}
