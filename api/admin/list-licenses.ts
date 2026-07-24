import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { LicenseRecord } from "../../lib/license";

function status(r: LicenseRecord): string {
  if (r.active === false) return "deactivated";
  if (r.expiresAt && new Date(r.expiresAt) < new Date()) return "expired";
  return "active";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
  const keys: string[] = await redis.smembers("all_licenses");

  const licenses = (await Promise.all(
    keys.map(async (key) => {
      const r = await redis.get<LicenseRecord>(`license:${key}`);
      if (!r) return null;
      return { key, status: status(r), type: r.type, scope: r.scope, tier: r.tier || "", label: r.label || "",
               allowedEmail: r.allowedEmail || "", allowedDomains: r.allowedDomains || [],
               maxUsers: r.maxUsers ?? 0, resellerId: r.resellerId || "", expiresAt: r.expiresAt, createdAt: r.createdAt };
    })
  )).filter(Boolean).sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

  return res.status(200).json({ count: licenses.length, licenses });
}
