import { Redis } from "@upstash/redis";

// ── Tier definitions ─────────────────────────────────────────────────────────
// Edit maxUsers here to change tier limits without touching any other code.
// maxUsers: 0 = unlimited
export const TIERS: Record<string, { maxUsers: number; label: string }> = {
  user:       { maxUsers: 1,   label: "Individual" },
  small:      { maxUsers: 50,  label: "Small (up to 50 users)" },
  business:   { maxUsers: 250, label: "Business (up to 250 users)" },
  enterprise: { maxUsers: 0,   label: "Enterprise (unlimited)" },
};

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

export async function validateLicense(key: string, userEmail?: string): Promise<LicenseValidation> {
  if (!key) return { valid: false, reason: "No license key provided" };

  // Admin key — permanent, bypasses all scope checks
  const adminKey = (process.env.ADMIN_LICENSE_KEY || "").trim();
  if (adminKey && key.trim().toUpperCase() === adminKey.toUpperCase()) {
    return { valid: true, type: "permanent", scope: "admin", expiresAt: null };
  }

  const redis = getRedis();
  const record = await redis.get<LicenseRecord>(`license:${key}`);
  if (!record) return { valid: false, reason: "Invalid license key" };

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
  return `MG-${seg()}-${seg()}-${seg()}-${seg()}`;
}
