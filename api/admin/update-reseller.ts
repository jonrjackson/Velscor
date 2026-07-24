import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRedis, ResellerRecord } from "../../lib/reseller";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const provided = String(req.headers["x-admin-secret"] || "").trim();
  const expected = (process.env.ADMIN_SECRET || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "Unauthorized" });

  const body        = req.body || {};
  const resellerKey = String(body.resellerKey || "").trim();
  if (!resellerKey) return res.status(400).json({ error: "resellerKey is required" });

  const redis    = getRedis();
  const existing = await redis.get<ResellerRecord>(`reseller:${resellerKey}`);
  if (!existing) return res.status(404).json({ error: "Reseller not found" });

  const updated: ResellerRecord = { ...existing };
  if (body.name         !== undefined) updated.name         = String(body.name);
  if (body.email        !== undefined) updated.email        = String(body.email);
  if (body.discountPct  !== undefined) updated.discountPct  = Number(body.discountPct);
  if (body.maxLicenses  !== undefined) updated.maxLicenses  = Number(body.maxLicenses);
  if (body.notes        !== undefined) updated.notes        = String(body.notes);
  if (body.active       !== undefined) updated.active       = Boolean(body.active);

  await redis.set(`reseller:${resellerKey}`, updated);
  return res.status(200).json({ resellerKey, ...updated });
}
