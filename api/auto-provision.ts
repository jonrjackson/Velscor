import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateByEmail } from "../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { userEmail } = req.body || {};
  if (!userEmail) return res.status(400).json({ valid: false, reason: "userEmail is required" });

  try {
    const result = await validateByEmail(String(userEmail));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("Auto-provision error:", err.message);
    return res.status(200).json({ valid: false, reason: "License lookup unavailable" });
  }
}
