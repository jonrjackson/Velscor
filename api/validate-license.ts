import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateLicense } from "../lib/license";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { key } = req.body || {};
  const result = await validateLicense(String(key || ""));
  return res.status(200).json(result);
}
