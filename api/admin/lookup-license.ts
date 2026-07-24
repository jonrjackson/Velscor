import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { LicenseRecord } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const { email, domain, key: directKey } = req.body || {};
  if (!email && !domain && !directKey) {
    return res.status(400).json({ error: "Provide email, domain, or key" });
  }

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
  const results: object[] = [];

  // Direct key lookup
  if (directKey) {
    const record = await redis.get<LicenseRecord>(`license:${directKey}`);
    if (record) results.push({ key: directKey, ...record });
  }

  // User email lookup
  if (email) {
    const emailNorm = String(email).toLowerCase().trim();
    const userKey   = await redis.get<string>(`email_license:${emailNorm}`);
    if (userKey) {
      const record = await redis.get<LicenseRecord>(`license:${userKey}`);
      if (record) results.push({ key: userKey, ...record });
    }
    // Also check org licenses for the email's domain
    const emailDomain = emailNorm.split("@")[1];
    if (emailDomain) {
      const orgKeys: string[] = await redis.smembers(`org_domain:${emailDomain}`);
      for (const k of orgKeys) {
        const record = await redis.get<LicenseRecord>(`license:${k}`);
        if (record) results.push({ key: k, ...record });
      }
    }
  }

  // Domain-only lookup
  if (domain && !email) {
    const domainNorm = String(domain).toLowerCase().trim();
    const orgKeys: string[]  = await redis.smembers(`org_domain:${domainNorm}`);
    for (const k of orgKeys) {
      const record = await redis.get<LicenseRecord>(`license:${k}`);
      if (record) results.push({ key: k, ...record });
    }
  }

  return res.status(200).json({ count: results.length, results });
}
