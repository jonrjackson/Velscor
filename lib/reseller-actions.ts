import { Redis } from "@upstash/redis";
import { generateKey, LicenseRecord, TIERS } from "./license";
import { ActionError } from "./admin-actions";

function daysRemaining(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

export async function createLicense(body: any, resellerKey: string, resellerName: string, maxLicenses: number, db: Redis) {
  const type          = String(body.type  || "paid") as "trial" | "paid";
  const scope         = String(body.scope || "org")  as "user" | "org";
  const trialDays     = Number(body.trialDays ?? 30);
  const tier          = String(body.tier         || "");
  const allowedEmail  = String(body.allowedEmail  || "");
  const label         = String(body.label         || "");
  const contactEmail  = String(body.contactEmail  || "");

  const rawDomains     = body.allowedDomains ?? body.allowedDomain ?? [];
  const allowedDomains: string[] = (Array.isArray(rawDomains) ? rawDomains : [rawDomains])
    .map((d: string) => String(d).toLowerCase().trim()).filter(Boolean);
  const maxUsers: number = body.maxUsers != null ? Number(body.maxUsers) : (TIERS[tier]?.maxUsers ?? 0);

  if (!["trial", "paid"].includes(type)) throw new ActionError(400, "type must be 'trial' or 'paid'");
  if (!["user", "org"].includes(scope))  throw new ActionError(400, "scope must be 'user' or 'org'");
  if (scope === "user" && !allowedEmail)          throw new ActionError(400, "allowedEmail required for user scope");
  if (scope === "org"  && !allowedDomains.length) throw new ActionError(400, "allowedDomain(s) required for org scope");

  // Enforce license cap
  if (maxLicenses > 0) {
    const count = await db.scard(`reseller_licenses:${resellerKey}`);
    if (count >= maxLicenses) {
      throw new ActionError(403, `License limit (${maxLicenses}) reached. Contact support to increase your limit.`);
    }
  }

  const key = generateKey();
  const now = new Date();
  const record: LicenseRecord = {
    type, scope,
    createdAt: now.toISOString(),
    expiresAt: type === "trial" ? new Date(now.getTime() + trialDays * 86_400_000).toISOString() : null,
    resellerId: resellerKey,
  };
  if (scope === "user") { record.allowedEmail   = allowedEmail.toLowerCase().trim(); }
  if (scope === "org")  { record.allowedDomains = allowedDomains; record.maxUsers = maxUsers; }
  if (tier)         record.tier         = tier;
  if (label)        record.label        = label;
  if (contactEmail) record.contactEmail = contactEmail;

  await db.set(`license:${key}`, record);
  await db.sadd(`reseller_licenses:${resellerKey}`, key);
  await db.sadd("all_licenses", key);
  if (scope === "org")  for (const d of allowedDomains) await db.sadd(`org_domain:${d}`, key);
  if (scope === "user" && record.allowedEmail) await db.set(`email_license:${record.allowedEmail}`, key);

  return { key, ...record };
}

export async function listLicenses(resellerKey: string, resellerName: string, db: Redis) {
  const keys: string[] = await db.smembers(`reseller_licenses:${resellerKey}`);
  const licenses = (await Promise.all(keys.map(async (key) => {
    const r = await db.get<LicenseRecord>(`license:${key}`);
    if (!r) return null;
    const expired = !!(r.expiresAt && new Date(r.expiresAt) < new Date());
    return {
      key, label: r.label || "", contactEmail: r.contactEmail || "",
      scope: r.scope, type: r.type, tier: r.tier || "",
      allowedEmail: r.allowedEmail || "",
      allowedDomains: r.allowedDomains || (r.allowedDomain ? [r.allowedDomain] : []),
      maxUsers: r.maxUsers ?? 0, createdAt: r.createdAt, expiresAt: r.expiresAt,
      daysRemaining: r.expiresAt ? daysRemaining(r.expiresAt) : null,
      status: r.active === false ? "deactivated" : expired ? "expired" : "active",
    };
  }))).filter(Boolean).sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());

  return { reseller: resellerName, count: licenses.length, licenses };
}

export async function updateLicense(body: any, resellerKey: string, db: Redis) {
  const key = String(body.key || "").trim();
  if (!key) throw new ActionError(400, "key is required");

  const owned = await db.sismember(`reseller_licenses:${resellerKey}`, key);
  if (!owned) throw new ActionError(403, "License not found in your account");

  const existing = await db.get<LicenseRecord>(`license:${key}`);
  if (!existing) throw new ActionError(404, "License not found");

  const updated: LicenseRecord = { ...existing };
  if (body.type !== undefined) {
    const newType = String(body.type) as "trial" | "paid";
    if (!["trial", "paid"].includes(newType)) throw new ActionError(400, "type must be 'trial' or 'paid'");
    updated.type = newType;
    if (newType === "paid") updated.expiresAt = null;
  }
  if (body.tier        !== undefined) { updated.tier = String(body.tier); if (body.maxUsers === undefined && TIERS[updated.tier]) updated.maxUsers = TIERS[updated.tier].maxUsers; }
  if (body.maxUsers    !== undefined) updated.maxUsers    = Number(body.maxUsers);
  if (body.expiresAt   !== undefined) updated.expiresAt   = body.expiresAt || null;
  if (body.label       !== undefined) updated.label       = String(body.label);
  if (body.contactEmail !== undefined) updated.contactEmail = String(body.contactEmail);
  if (body.allowedDomains !== undefined) {
    const raw = Array.isArray(body.allowedDomains) ? body.allowedDomains : [body.allowedDomains];
    updated.allowedDomains = raw.map((d: string) => String(d).toLowerCase().trim()).filter(Boolean);
    delete updated.allowedDomain;
    for (const d of updated.allowedDomains) await db.sadd(`org_domain:${d}`, key);
  }
  if (body.allowedEmail !== undefined) updated.allowedEmail = String(body.allowedEmail).toLowerCase().trim();

  await db.set(`license:${key}`, updated);
  return { key, ...updated };
}
