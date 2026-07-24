import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { validateResellerKey } from "../lib/reseller";
import { ActionError } from "../lib/admin-actions";
import { createLicense, listLicenses, updateLicense } from "../lib/reseller-actions";

function redis(): Redis {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const resellerKey = String(req.headers["x-reseller-key"] || "").trim();
  const auth = await validateResellerKey(resellerKey);
  if (!auth.valid) return res.status(401).json({ error: auth.reason });

  const db     = redis();
  const body   = req.body || {};
  const action = String(body.action || "");
  const name   = auth.reseller!.name;
  const cap    = auth.reseller!.maxLicenses ?? 0;

  try {
    switch (action) {
      case "create-license": return res.status(200).json(await createLicense(body, resellerKey, name, cap, db));
      case "list-licenses":  return res.status(200).json(await listLicenses(resellerKey, name, db));
      case "update-license": return res.status(200).json(await updateLicense(body, resellerKey, db));
      default:
        return res.status(400).json({ error: `Unknown action: ${action}`, available: ["create-license", "list-licenses", "update-license"] });
    }
  } catch (err) {
    if (err instanceof ActionError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}
