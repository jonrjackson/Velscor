import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRedis, generateResellerKey, ResellerRecord } from "../lib/reseller";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const providedSecret = String(req.headers["x-admin-secret"] || "").trim();
  const expectedSecret = (process.env.ADMIN_SECRET || "").trim();
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body        = req.body || {};
  const name        = String(body.name        || "").trim();
  const email       = String(body.email       || "").trim();
  const discountPct = Number(body.discountPct ?? 35);
  const notes       = String(body.notes       || "");

  if (!name)  return res.status(400).json({ error: "name is required" });
  if (!email) return res.status(400).json({ error: "email is required" });
  if (discountPct < 0 || discountPct > 80) {
    return res.status(400).json({ error: "discountPct must be between 0 and 80" });
  }

  const key: string = generateResellerKey();
  const record: ResellerRecord = {
    name,
    email,
    discountPct,
    createdAt: new Date().toISOString(),
    active: true,
    ...(notes && { notes }),
  };

  await getRedis().set(`reseller:${key}`, record);

  return res.status(200).json({ resellerKey: key, ...record });
}
