import { Redis } from "@upstash/redis";

// ── Tier definitions ─────────────────────────────────────────────────────────
// Edit maxUsers here to change tier limits without touching any other code.
// maxUsers: 0 = unlimited
// priceMonthly/priceNote are display-only (marketing pricing page) — not enforced here.
export const TIERS: Record<string, { maxUsers: number; label: string; priceMonthly?: number; priceNote?: string }> = {
  user:       { maxUsers: 1,   label: "Individual",                priceMonthly: 4.99 },
  small:      { maxUsers: 50,  label: "Small (up to 50 users)",     priceMonthly: 79 },
  business:   { maxUsers: 250, label: "Business (up to 250 users)", priceMonthly: 299 },
  enterprise: { maxUsers: 0,   label: "Enterprise (unlimited)",     priceNote: "Contact us" },
};

// Flat wholesale rate resellers pay per seat per month, regardless of which
// tier label a license was created under (the tier dropdown only presets
// maxUsers for resellers now — it no longer drives price).
export const RESELLER_PRICE_PER_SEAT = 1.25;

export interface LicenseRecord {
  type: "permanent" | "trial" | "paid";
  scope: "user" | "org";
  createdAt: string;
  expiresAt: string | null;
  // Scope enforcement
  allowedEmail?: string;     // user scope — specific address
  allowedDomains?: string[]; // org scope — all domains in the tenant
  allowedDomain?: string;    // legacy single-domain (still supported)
  maxUsers?: number;         // org scope — 0 = unlimited
  // Metadata (billing reference only, not enforced)
  tier?: string;
  label?: string;
  contactEmail?: string;
  discountPct?: number;
  discountNote?: string;
  resellerId?: string;
  stripeCustomerId?: string;     // set when the license originated from a self-serve Stripe checkout
  stripeSubscriptionId?: string;
  active?: boolean; // undefined = active (backward compat); false = deactivated
}

export interface LicenseValidation {
  valid: boolean;
  reason?: string;
  type?: string;
  scope?: string;
  expiresAt?: string | null;
}

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

// Validate by domain — used for auto-provisioned org users (no key required)
export async function validateByEmail(userEmail: string): Promise<LicenseValidation> {
  const domain = userEmail.split("@")[1]?.toLowerCase().trim();
  if (!domain) return { valid: false, reason: "Invalid email address" };

  const redis = getRedis();
  const keys: string[] = await redis.smembers(`org_domain:${domain}`);

  for (const key of keys) {
    const record = await redis.get<LicenseRecord>(`license:${key}`);
    if (!record) continue;
    if (record.active === false) continue;
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) continue;

    // Enforce seat limit
    const maxUsers = record.maxUsers ?? 0;
    if (maxUsers > 0) {
      const usersKey = `license_users:${key}`;
      const email    = userEmail.toLowerCase().trim();
      const seen     = await redis.sismember(usersKey, email);
      if (!seen) {
        const count = await redis.scard(usersKey);
        if (count >= maxUsers) continue; // seat limit hit — try next key
        await redis.sadd(usersKey, email);
      }
    }

    return { valid: true, type: record.type, scope: record.scope, expiresAt: record.expiresAt };
  }

  return { valid: false, reason: "No active license found for your organization" };
}

export async function validateLicense(key: string, userEmail?: string): Promise<LicenseValidation> {
  if (!key) return { valid: false, reason: "No license key provided" };

  // Admin key — permanent, bypasses all scope checks
  const adminKey = (process.env.ADMIN_LICENSE_KEY || "").trim();
  if (adminKey && key.trim().toUpperCase() === adminKey.toUpperCase()) {
    return { valid: true, type: "permanent", scope: "admin", expiresAt: null };
  }

  const redis = getRedis();
  const record = await redis.get<LicenseRecord>(`license:${key}`);
  if (!record)                 return { valid: false, reason: "Invalid license key" };
  if (record.active === false) return { valid: false, reason: "License has been deactivated" };
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return { valid: false, reason: "License has expired" };
  }

  // Scope enforcement (only when userEmail is provided)
  if (userEmail) {
    const email = userEmail.toLowerCase().trim();

    if (record.scope === "user") {
      if (email !== (record.allowedEmail || "").toLowerCase().trim()) {
        return { valid: false, reason: "This license key is registered to a different user" };
      }
    }

    if (record.scope === "org") {
      const userDomain = email.split("@")[1] || "";
      // Support both allowedDomains (array) and legacy allowedDomain (string)
      const domains = (record.allowedDomains || [])
        .concat(record.allowedDomain ? [record.allowedDomain] : [])
        .map(d => d.toLowerCase().trim());
      if (!domains.includes(userDomain)) {
        return { valid: false, reason: "This license key is registered to a different organization" };
      }

      // Enforce user seat limit (maxUsers > 0 means limited)
      const maxUsers = record.maxUsers ?? 0;
      if (maxUsers > 0) {
        const usersKey = `license_users:${key}`;
        const alreadySeen = await redis.sismember(usersKey, email);
        if (!alreadySeen) {
          const currentCount = await redis.scard(usersKey);
          if (currentCount >= maxUsers) {
            return { valid: false, reason: `User seat limit (${maxUsers}) reached for this license` };
          }
          await redis.sadd(usersKey, email);
        }
      }
    }
  }

  return { valid: true, type: record.type, scope: record.scope, expiresAt: record.expiresAt };
}

export function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `VS-${seg()}-${seg()}-${seg()}-${seg()}`;
}
