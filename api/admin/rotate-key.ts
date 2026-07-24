import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { LicenseRecord, generateKey } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const { key: oldKey } = req.body || {};
  if (!oldKey) return res.status(400).json({ error: "key is required" });

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
  const record = await redis.get<LicenseRecord>(`license:${oldKey}`);
  if (!record) return res.status(404).json({ error: "License not found" });

  const newKey = generateKey();

  // Write new key with same record
  await redis.set(`license:${newKey}`, record);
  await redis.sadd("all_licenses", newKey);

  // Update reseller index if applicable
  if (record.resellerId) {
    await redis.sadd(`reseller_licenses:${record.resellerId}`, newKey);
    await redis.srem(`reseller_licenses:${record.resellerId}`, oldKey);
  }

  // Update domain index
  const domains = record.allowedDomains || (record.allowedDomain ? [record.allowedDomain] : []);
  for (const domain of domains) {
    await redis.sadd(`org_domain:${domain}`, newKey);
    await redis.srem(`org_domain:${domain}`, oldKey);
  }

  // Update email index
  if (record.allowedEmail) {
    await redis.set(`email_license:${record.allowedEmail}`, newKey);
  }

  // Deactivate old key
  await redis.set(`license:${oldKey}`, { ...record, active: false });

  return res.status(200).json({ oldKey, newKey, message: "Old key deactivated. Send new key to customer." });
}
