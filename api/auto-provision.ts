import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateByEmail } from "../lib/license";
import { getRedis } from "../lib/reseller";
import { enforceLimits, clientIp } from "../lib/rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { userEmail } = req.body || {};
  if (!userEmail) return res.status(400).json({ valid: false, reason: "userEmail is required" });

  // Each add-in caches a successful check, so legitimate traffic is roughly
  // one call per user per Outlook install — this mostly stops domain probing.
  const allowed = await enforceLimits(req, res, getRedis(), [
    { bucket: "provision:user", id: String(userEmail), limit: 30,  windowSec: 3600 },
    { bucket: "provision:ip",   id: clientIp(req),     limit: 600, windowSec: 3600 },
  ]);
  if (!allowed) return;

  try {
    const result = await validateByEmail(String(userEmail));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("Auto-provision error:", err.message);
    return res.status(200).json({ valid: false, reason: "License lookup unavailable" });
  }
}
