import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { LicenseRecord } from "../../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const { key, reason = "" } = req.body || {};
  if (!key) return res.status(400).json({ error: "key is required" });

  const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
  const record = await redis.get<LicenseRecord>(`license:${key}`);
  if (!record) return res.status(404).json({ error: "License not found" });

  const updated: LicenseRecord = { ...record, active: false };
  if (reason) updated.discountNote = `Deactivated: ${reason}`;
  await redis.set(`license:${key}`, updated);

  return res.status(200).json({ key, status: "deactivated", reason });
}
