import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateLicense } from "../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { key } = req.body || {};
  try {
    const result = await validateLicense(String(key || ""));
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("License validation error:", err.message);
    return res.status(200).json({ valid: false, reason: "License server error — check Upstash configuration" });
  }
}
