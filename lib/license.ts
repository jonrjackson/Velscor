import { Redis } from "@upstash/redis";

export interface LicenseRecord {
  type: "permanent" | "trial" | "paid";
  createdAt: string;
  expiresAt: string | null;
  email?: string;
  label?: string;
}

export interface LicenseValidation {
  valid: boolean;
  reason?: string;
  type?: string;
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

export async function validateLicense(key: string): Promise<LicenseValidation> {
  if (!key) return { valid: false, reason: "No license key provided" };

  // Admin key is always valid — no database needed
  if (key === process.env.ADMIN_LICENSE_KEY) {
    return { valid: true, type: "permanent", expiresAt: null };
  }

  const record = await getRedis().get<LicenseRecord>(`license:${key}`);
  if (!record) return { valid: false, reason: "Invalid license key" };

  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return { valid: false, reason: "Trial license has expired" };
  }

  return { valid: true, type: record.type, expiresAt: record.expiresAt };
}

export function generateKey(): string {
  // Avoids ambiguous characters (0/O, 1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `MG-${seg()}-${seg()}-${seg()}-${seg()}`;
}
