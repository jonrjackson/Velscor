import { Redis } from "@upstash/redis";

export interface ResellerRecord {
  name: string;
  email: string;
  discountPct: number;
  createdAt: string;
  active: boolean;
  maxLicenses?: number; // 0 = unlimited
  notes?: string;
}

export interface ResellerValidation {
  valid: boolean;
  reason?: string;
  reseller?: ResellerRecord;
  resellerKey?: string;
}

let _redis: Redis | null = null;
export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

export async function validateResellerKey(key: string): Promise<ResellerValidation> {
  if (!key) return { valid: false, reason: "No reseller key provided" };
  const record = await getRedis().get<ResellerRecord>(`reseller:${key}`);
  if (!record)        return { valid: false, reason: "Invalid reseller key" };
  if (!record.active) return { valid: false, reason: "Reseller account is inactive" };
  return { valid: true, reseller: record, resellerKey: key };
}

export function generateResellerKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `MGR-${seg()}-${seg()}-${seg()}`;
}
