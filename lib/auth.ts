import { currentUser } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import { ResellerRecord } from "./reseller";
import { lookupLicense } from "./admin-actions";

export type ResolvedRole =
  | { role: "admin"; email: string }
  | { role: "reseller"; resellerKey: string; reseller: ResellerRecord }
  | { role: "customer"; email: string; licenses: object[] }
  | { role: "none"; email: string | null };

function redis(): Redis {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function resolveReseller(clerkUserId: string, email: string, db: Redis): Promise<ResellerRecord & { resellerKey: string } | null> {
  const mappedKey = await db.get<string>(`reseller_by_clerk:${clerkUserId}`);
  if (mappedKey) {
    const record = await db.get<ResellerRecord>(`reseller:${mappedKey}`);
    if (record && record.active) return { ...record, resellerKey: mappedKey };
  }

  // Fallback: scan resellers for a case-insensitive email match, then persist the mapping.
  const keys: string[] = await db.smembers("all_resellers");
  for (const key of keys) {
    const record = await db.get<ResellerRecord>(`reseller:${key}`);
    if (record && record.active && record.email.toLowerCase().trim() === email) {
      await db.set(`reseller_by_clerk:${clerkUserId}`, key);
      await db.set(`reseller:${key}`, { ...record, clerkUserId });
      return { ...record, clerkUserId, resellerKey: key };
    }
  }
  return null;
}

export async function resolveRole(): Promise<ResolvedRole> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase().trim() || null;
  if (!user || !email) return { role: "none", email: null };

  if (adminEmails().includes(email)) {
    return { role: "admin", email };
  }

  const db = redis();

  const reseller = await resolveReseller(user.id, email, db);
  if (reseller) {
    return { role: "reseller", resellerKey: reseller.resellerKey, reseller };
  }

  const { results } = await lookupLicense({ email }, db);
  if (results.length > 0) {
    return { role: "customer", email, licenses: results };
  }

  return { role: "none", email };
}
