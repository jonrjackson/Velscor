import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { generateKey, LicenseRecord } from "../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const providedSecret = String(req.headers["x-admin-secret"] || "").trim();
  const expectedSecret = (process.env.ADMIN_SECRET || "").trim();
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { type = "trial", trialDays = 30, email = "", label = "" } = req.body || {};

  if (!["trial", "paid"].includes(type)) {
    return res.status(400).json({ error: "type must be 'trial' or 'paid'" });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const key = generateKey();
  const now = new Date();
  const record: LicenseRecord = {
    type,
    createdAt: now.toISOString(),
    expiresAt: type === "trial"
      ? new Date(now.getTime() + Number(trialDays) * 86_400_000).toISOString()
      : null,
    email: email || undefined,
    label: label || undefined,
  };

  await redis.set(`license:${key}`, record);

  return res.status(200).json({ key, ...record });
}
