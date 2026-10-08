import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

export interface Limit {
  bucket: string;    // e.g. "analyze:ip"
  id: string;        // who is being limited — an IP, email, or key
  limit: number;     // max requests per window
  windowSec: number;
}

// Vercel overwrites x-forwarded-for / x-real-ip at its edge, so these can't be
// spoofed by the caller.
export function clientIp(req: VercelRequest): string {
  const real = String(req.headers["x-real-ip"] || "").trim();
  if (real) return real;
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

// Fixed-window counters in Redis. Fails open: a Redis hiccup shouldn't take
// analysis down with it. Responds 429 and returns false when any limit is hit.
// Limits are generous on purpose — a whole office often shares one IP.
export async function enforceLimits(req: VercelRequest, res: VercelResponse, db: Redis, limits: Limit[]): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  for (const l of limits) {
    if (!l.id) continue;
    const window = Math.floor(now / l.windowSec);
    const key = `ratelimit:${l.bucket}:${l.id.toLowerCase().trim().slice(0, 200)}:${window}`;
    let count: number;
    try {
      count = await db.incr(key);
      if (count === 1) await db.expire(key, l.windowSec);
    } catch (err: any) {
      console.error("Rate limiter unavailable:", err?.message);
      return true;
    }
    if (count > l.limit) {
      const retryAfter = l.windowSec - (now % l.windowSec);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: `Too many requests. Please try again in ${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? "s" : ""}.`,
        valid: false,
        retryAfter,
      });
      return false;
    }
  }
  return true;
}
