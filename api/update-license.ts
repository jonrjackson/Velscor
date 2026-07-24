import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { LicenseRecord, TIERS } from "../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const providedSecret = String(req.headers["x-admin-secret"] || "").trim();
  const expectedSecret = (process.env.ADMIN_SECRET || "").trim();
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  const key  = String(body.key || "").trim();
  if (!key) return res.status(400).json({ error: "key is required" });

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const existing = await redis.get<LicenseRecord>(`license:${key}`);
  if (!existing) return res.status(404).json({ error: "License key not found" });

  // Apply only the fields that were provided
  const updated: LicenseRecord = { ...existing };

  if (body.tier !== undefined) {
    updated.tier = String(body.tier);
    // Auto-set maxUsers from tier if maxUsers not explicitly provided
    if (body.maxUsers === undefined && TIERS[updated.tier]) {
      updated.maxUsers = TIERS[updated.tier].maxUsers;
    }
  }
  if (body.maxUsers  !== undefined) updated.maxUsers  = Number(body.maxUsers);
  if (body.type      !== undefined) updated.type       = body.type as LicenseRecord["type"];
  if (body.expiresAt !== undefined) updated.expiresAt  = body.expiresAt || null;
  if (body.label     !== undefined) updated.label      = String(body.label);
  if (body.discountPct  !== undefined) updated.discountPct  = Number(body.discountPct);
  if (body.discountNote !== undefined) updated.discountNote = String(body.discountNote);

  // Domain updates for org keys
  if (body.allowedDomains !== undefined) {
    const raw = Array.isArray(body.allowedDomains) ? body.allowedDomains : [body.allowedDomains];
    updated.allowedDomains = raw.map((d: string) => String(d).toLowerCase().trim()).filter(Boolean);
    delete updated.allowedDomain; // remove legacy field if present
  }
  if (body.allowedEmail !== undefined) {
    updated.allowedEmail = String(body.allowedEmail).toLowerCase().trim();
  }

  await redis.set(`license:${key}`, updated);

  return res.status(200).json({ key, ...updated });
}
