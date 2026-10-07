import { Redis } from "@upstash/redis";
import { generateKey, parseDomains, LicenseRecord, TIERS } from "./license";
import { generateResellerKey, ResellerRecord } from "./reseller";

export class ActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function licenseStatus(r: LicenseRecord): string {
  if (r.active === false) return "deactivated";
  if (r.expiresAt && new Date(r.expiresAt) < new Date()) return "expired";
  return "active";
}

// Reseller-owned paid licenses run on a 30-day billing cycle plus a 5-day
// grace period (see lib/reseller-actions.ts) — the invoice.paid webhook pushes
// the expiry forward on each successful payment.
const resellerPaidExpiry = () => new Date(Date.now() + 35 * 86_400_000).toISOString();

async function requireReseller(resellerId: string, db: Redis) {
  const reseller = await db.get<ResellerRecord>(`reseller:${resellerId}`);
  if (!reseller) throw new ActionError(404, "Reseller not found");
}

// ── License actions ──────────────────────────────────────────────────────────

export async function createLicense(body: any, db: Redis) {
  const type          = String(body.type  || "trial") as "trial" | "paid";
  const scope         = String(body.scope || "org")   as "user" | "org";
  const trialDays     = Number(body.trialDays ?? 30);
  const tier          = String(body.tier         || "");
  const allowedEmail  = String(body.allowedEmail  || "");
  const label         = String(body.label         || "");
  const contactEmail  = String(body.contactEmail  || "");
  const discountPct   = Number(body.discountPct   || 0);
  const discountNote  = String(body.discountNote  || "");
  const resellerId    = String(body.resellerId    || "").trim();

  const allowedDomains: string[] = parseDomains(body.allowedDomains ?? body.allowedDomain ?? []);
  const maxUsers: number = body.maxUsers != null ? Number(body.maxUsers) : (TIERS[tier]?.maxUsers ?? 0);

  if (!["trial", "paid"].includes(type)) throw new ActionError(400, "type must be 'trial' or 'paid'");
  if (!["user", "org"].includes(scope))  throw new ActionError(400, "scope must be 'user' or 'org'");
  if (scope === "user" && !allowedEmail)         throw new ActionError(400, "allowedEmail required for user scope");
  if (scope === "org"  && !allowedDomains.length) throw new ActionError(400, "allowedDomain(s) required for org scope");
  if (resellerId) await requireReseller(resellerId, db);

  const key = generateKey();
  const now = new Date();
  const record: LicenseRecord = {
    type, scope,
    createdAt: now.toISOString(),
    expiresAt: type === "trial" ? new Date(now.getTime() + trialDays * 86_400_000).toISOString()
             : resellerId       ? resellerPaidExpiry()
             : null,
  };
  if (resellerId) record.resellerId = resellerId;
  if (scope === "user") { record.allowedEmail   = allowedEmail.toLowerCase().trim(); }
  if (scope === "org")  { record.allowedDomains = allowedDomains; record.maxUsers = maxUsers; }
  if (tier)         record.tier         = tier;
  if (label)        record.label        = label;
  if (contactEmail) record.contactEmail = contactEmail;
  if (discountPct)  record.discountPct  = discountPct;
  if (discountNote) record.discountNote = discountNote;
  if (body.stripeCustomerId)     record.stripeCustomerId     = String(body.stripeCustomerId);
  if (body.stripeSubscriptionId) record.stripeSubscriptionId = String(body.stripeSubscriptionId);

  await db.set(`license:${key}`, record);
  await db.sadd("all_licenses", key);
  if (resellerId) await db.sadd(`reseller_licenses:${resellerId}`, key);
  if (scope === "org")  for (const d of allowedDomains) await db.sadd(`org_domain:${d}`, key);
  if (scope === "user" && record.allowedEmail) await db.set(`email_license:${record.allowedEmail}`, key);

  return { key, ...record };
}

export async function updateLicense(body: any, db: Redis) {
  const key = String(body.key || "").trim();
  if (!key) throw new ActionError(400, "key is required");

  const existing = await db.get<LicenseRecord>(`license:${key}`);
  if (!existing) throw new ActionError(404, "License not found");

  // Reseller (re)assignment — "" moves the license back to direct.
  const prevReseller = existing.resellerId || "";
  const nextReseller = body.resellerId !== undefined ? String(body.resellerId || "").trim() : prevReseller;
  const resellerChanged = nextReseller !== prevReseller;
  if (resellerChanged && nextReseller) {
    await requireReseller(nextReseller, db);
    // A self-serve subscription already bills the customer directly; putting
    // it under a reseller would bill the same seats twice.
    if (existing.stripeSubscriptionId) {
      throw new ActionError(400, "This license is billed through its own Stripe subscription — cancel that before assigning it to a reseller");
    }
  }

  const updated: LicenseRecord = { ...existing };
  if (body.tier      !== undefined) { updated.tier = String(body.tier); if (body.maxUsers === undefined && TIERS[updated.tier]) updated.maxUsers = TIERS[updated.tier].maxUsers; }
  if (body.maxUsers  !== undefined) updated.maxUsers  = Number(body.maxUsers);
  if (body.type      !== undefined) updated.type      = body.type as LicenseRecord["type"];
  if (body.expiresAt !== undefined) updated.expiresAt = body.expiresAt || null;
  if (body.label     !== undefined) updated.label     = String(body.label);
  if (body.contactEmail !== undefined) updated.contactEmail = String(body.contactEmail);
  if (body.discountPct  !== undefined) updated.discountPct  = Number(body.discountPct);
  if (body.discountNote !== undefined) updated.discountNote = String(body.discountNote);
  if (body.active    !== undefined) updated.active    = Boolean(body.active);
  if (body.allowedDomains !== undefined) {
    const domains = parseDomains(body.allowedDomains);
    const previous = existing.allowedDomains || (existing.allowedDomain ? [existing.allowedDomain] : []);
    updated.allowedDomains = domains;
    delete updated.allowedDomain;
    for (const d of previous) if (!domains.includes(d)) await db.srem(`org_domain:${d}`, key);
    for (const d of domains) await db.sadd(`org_domain:${d}`, key);
  }
  if (body.allowedEmail !== undefined) updated.allowedEmail = String(body.allowedEmail).toLowerCase().trim();

  if (resellerChanged) {
    if (nextReseller) {
      updated.resellerId = nextReseller;
      // A paid license with no expiry would be billed to the reseller but
      // never lapse on non-payment — start it on the reseller billing cycle.
      if (updated.type === "paid" && !updated.expiresAt) updated.expiresAt = resellerPaidExpiry();
    } else {
      delete updated.resellerId;
    }
  }

  await db.set(`license:${key}`, updated);
  if (resellerChanged) {
    if (prevReseller) await db.srem(`reseller_licenses:${prevReseller}`, key);
    if (nextReseller) await db.sadd(`reseller_licenses:${nextReseller}`, key);
  }
  return { key, ...updated };
}

export async function deactivateLicense(body: any, db: Redis) {
  const key = String(body.key || "").trim();
  if (!key) throw new ActionError(400, "key is required");
  const record = await db.get<LicenseRecord>(`license:${key}`);
  if (!record) throw new ActionError(404, "License not found");
  await db.set(`license:${key}`, { ...record, active: false });
  return { key, status: "deactivated" };
}

export async function deleteLicense(body: any, db: Redis) {
  const key = String(body.key || "").trim();
  if (!key) throw new ActionError(400, "key is required");
  const record = await db.get<LicenseRecord>(`license:${key}`);
  if (!record) throw new ActionError(404, "License not found");

  await db.del(`license:${key}`);
  await db.srem("all_licenses", key);
  if (record.resellerId) await db.srem(`reseller_licenses:${record.resellerId}`, key);
  if (record.allowedEmail) await db.del(`email_license:${record.allowedEmail}`);
  const domains = record.allowedDomains || (record.allowedDomain ? [record.allowedDomain] : []);
  for (const d of domains) await db.srem(`org_domain:${d}`, key);

  return { key, deleted: true };
}

export async function rotateKey(body: any, db: Redis) {
  const oldKey = String(body.key || "").trim();
  if (!oldKey) throw new ActionError(400, "key is required");
  const record = await db.get<LicenseRecord>(`license:${oldKey}`);
  if (!record) throw new ActionError(404, "License not found");

  const newKey = generateKey();
  await db.set(`license:${newKey}`, record);
  await db.sadd("all_licenses", newKey);
  if (record.resellerId) { await db.sadd(`reseller_licenses:${record.resellerId}`, newKey); await db.srem(`reseller_licenses:${record.resellerId}`, oldKey); }
  const domains = record.allowedDomains || (record.allowedDomain ? [record.allowedDomain] : []);
  for (const d of domains) { await db.sadd(`org_domain:${d}`, newKey); await db.srem(`org_domain:${d}`, oldKey); }
  if (record.allowedEmail) await db.set(`email_license:${record.allowedEmail}`, newKey);
  await db.set(`license:${oldKey}`, { ...record, active: false });

  return { oldKey, newKey, message: "Old key deactivated. Send new key to customer." };
}

export async function listLicenses(db: Redis) {
  const keys: string[] = await db.smembers("all_licenses");
  const licenses = (await Promise.all(keys.map(async (key) => {
    const r = await db.get<LicenseRecord>(`license:${key}`);
    if (!r) return null;
    return { key, status: licenseStatus(r), type: r.type, scope: r.scope, tier: r.tier || "",
             label: r.label || "", allowedEmail: r.allowedEmail || "",
             allowedDomains: r.allowedDomains || [], maxUsers: r.maxUsers ?? 0,
             resellerId: r.resellerId || "", expiresAt: r.expiresAt, createdAt: r.createdAt };
  }))).filter((l): l is NonNullable<typeof l> => l !== null).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { count: licenses.length, licenses };
}

export async function lookupLicense(body: any, db: Redis) {
  const { email, domain, key: directKey } = body;
  if (!email && !domain && !directKey) throw new ActionError(400, "Provide email, domain, or key");
  const results: object[] = [];

  if (directKey) {
    const r = await db.get<LicenseRecord>(`license:${directKey}`);
    if (r) results.push({ key: directKey, ...r });
  }
  if (email) {
    const norm = String(email).toLowerCase().trim();
    const userKey = await db.get<string>(`email_license:${norm}`);
    if (userKey) { const r = await db.get<LicenseRecord>(`license:${userKey}`); if (r) results.push({ key: userKey, ...r }); }
    const emailDomain = norm.split("@")[1];
    if (emailDomain) {
      const orgKeys: string[] = await db.smembers(`org_domain:${emailDomain}`);
      for (const k of orgKeys) { const r = await db.get<LicenseRecord>(`license:${k}`); if (r) results.push({ key: k, ...r }); }
    }
  }
  if (domain && !email) {
    const orgKeys: string[] = await db.smembers(`org_domain:${String(domain).toLowerCase().trim()}`);
    for (const k of orgKeys) { const r = await db.get<LicenseRecord>(`license:${k}`); if (r) results.push({ key: k, ...r }); }
  }
  return { count: results.length, results };
}

// ── Read-only helper (new) ───────────────────────────────────────────────────

export async function getSeatUsage(key: string, db: Redis) {
  const record = await db.get<LicenseRecord>(`license:${key}`);
  if (!record) throw new ActionError(404, "License not found");
  const maxUsers = record.maxUsers ?? 0;
  const used = await db.scard(`license_users:${key}`);
  return { key, maxUsers, used, unlimited: maxUsers === 0 };
}

// Distinct people currently able to use Velscor, across every active,
// non-expired license — org-scope licenses count actual seat usage
// (license_users:<key>, populated as real users validate), not just the
// seat limit; user-scope licenses count as one each. Deduplicated globally
// in case the same email shows up under more than one license.
export async function getUserStats(db: Redis) {
  const allLicenseKeys: string[] = await db.smembers("all_licenses");
  const records = await Promise.all(allLicenseKeys.map(k => db.get<LicenseRecord>(`license:${k}`)));

  const isActive = (r: LicenseRecord) => r.active !== false && (!r.expiresAt || new Date(r.expiresAt) > new Date());

  const orgUserSets = await Promise.all(
    allLicenseKeys.map((key, i) => {
      const r = records[i];
      return r && r.scope === "org" && isActive(r) ? db.smembers(`license_users:${key}`) : Promise.resolve([] as string[]);
    })
  );

  const distinctUsers = new Set<string>();
  orgUserSets.forEach(emails => emails.forEach(e => distinctUsers.add(e.toLowerCase().trim())));
  records.forEach(r => {
    if (r && r.scope === "user" && isActive(r) && r.allowedEmail) distinctUsers.add(r.allowedEmail.toLowerCase().trim());
  });

  return { totalUsers: distinctUsers.size };
}

// ── Billing / reseller actions ───────────────────────────────────────────────

export async function billingReport(db: Redis) {
  const resellerKeys: string[]  = await db.smembers("all_resellers");
  const allLicenseKeys: string[] = await db.smembers("all_licenses");
  const resellerOwned = new Set<string>();

  const resellers = (await Promise.all(resellerKeys.map(async (rKey) => {
    const reseller = await db.get<ResellerRecord>(`reseller:${rKey}`);
    if (!reseller) return null;
    const licKeys: string[] = await db.smembers(`reseller_licenses:${rKey}`);
    licKeys.forEach(k => resellerOwned.add(k));
    const lics = await Promise.all(licKeys.map(k => db.get<LicenseRecord>(`license:${k}`)));
    const active  = lics.filter(r => r && r.active !== false && (!r.expiresAt || new Date(r.expiresAt) > new Date())).length;
    const expired = lics.filter(r => r && r.active !== false && r.expiresAt && new Date(r.expiresAt) <= new Date()).length;
    return { resellerKey: rKey, name: reseller.name, email: reseller.email, discountPct: reseller.discountPct, active: reseller.active, totalLicenses: licKeys.length, activeLicenses: active, expiredLicenses: expired };
  }))).filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => b.activeLicenses - a.activeLicenses);

  const directKeys = allLicenseKeys.filter(k => !resellerOwned.has(k));
  const directLics = await Promise.all(directKeys.map(k => db.get<LicenseRecord>(`license:${k}`)));
  const directActive  = directLics.filter(r => r && r.active !== false && (!r.expiresAt || new Date(r.expiresAt) > new Date())).length;
  const directExpired = directLics.filter(r => r && r.active !== false && r.expiresAt && new Date(r.expiresAt) <= new Date()).length;

  return { generatedAt: new Date().toISOString(), resellers, direct: { totalLicenses: directKeys.length, activeLicenses: directActive, expiredLicenses: directExpired } };
}

export async function createReseller(body: any, db: Redis) {
  const name        = String(body.name        || "").trim();
  const email       = String(body.email       || "").trim();
  const discountPct = Number(body.discountPct ?? 0);
  const maxLicenses = Number(body.maxLicenses ?? 0);
  const notes       = String(body.notes       || "");
  if (!name)  throw new ActionError(400, "name is required");
  if (!email) throw new ActionError(400, "email is required");

  const key    = generateResellerKey();
  const record: ResellerRecord = { name, email, discountPct, createdAt: new Date().toISOString(), active: true, ...(maxLicenses && { maxLicenses }), ...(notes && { notes }) };
  await db.set(`reseller:${key}`, record);
  await db.sadd("all_resellers", key);
  return { resellerKey: key, ...record };
}

export async function updateReseller(body: any, db: Redis) {
  const rKey = String(body.resellerKey || "").trim();
  if (!rKey) throw new ActionError(400, "resellerKey is required");
  const existing = await db.get<ResellerRecord>(`reseller:${rKey}`);
  if (!existing) throw new ActionError(404, "Reseller not found");
  const updated = { ...existing };
  if (body.name        !== undefined) updated.name        = String(body.name);
  if (body.email       !== undefined) updated.email       = String(body.email);
  if (body.discountPct !== undefined) updated.discountPct = Number(body.discountPct);
  if (body.maxLicenses !== undefined) updated.maxLicenses = Number(body.maxLicenses);
  if (body.notes       !== undefined) updated.notes       = String(body.notes);
  if (body.active      !== undefined) updated.active      = Boolean(body.active);
  await db.set(`reseller:${rKey}`, updated);
  return { resellerKey: rKey, ...updated };
}

export async function deactivateReseller(body: any, db: Redis) {
  const rKey   = String(body.resellerKey || "").trim();
  const cascade = body.cascade !== false;
  if (!rKey) throw new ActionError(400, "resellerKey is required");
  const reseller = await db.get<ResellerRecord>(`reseller:${rKey}`);
  if (!reseller) throw new ActionError(404, "Reseller not found");
  await db.set(`reseller:${rKey}`, { ...reseller, active: false });

  let deactivated = 0;
  if (cascade) {
    const licKeys: string[] = await db.smembers(`reseller_licenses:${rKey}`);
    await Promise.all(licKeys.map(async (key) => {
      const r = await db.get<LicenseRecord>(`license:${key}`);
      if (r && r.active !== false) { await db.set(`license:${key}`, { ...r, active: false }); deactivated++; }
    }));
  }
  return { resellerKey: rKey, status: "deactivated", cascade, deactivatedLicenses: deactivated };
}

export async function reactivateReseller(body: any, db: Redis) {
  const rKey    = String(body.resellerKey || "").trim();
  const cascade = body.cascade === true || body.cascade === "true";
  if (!rKey) throw new ActionError(400, "resellerKey is required");
  const reseller = await db.get<ResellerRecord>(`reseller:${rKey}`);
  if (!reseller) throw new ActionError(404, "Reseller not found");
  await db.set(`reseller:${rKey}`, { ...reseller, active: true });

  let reactivated = 0;
  if (cascade) {
    const licKeys: string[] = await db.smembers(`reseller_licenses:${rKey}`);
    await Promise.all(licKeys.map(async (key) => {
      const r = await db.get<LicenseRecord>(`license:${key}`);
      if (r && r.active === false) { await db.set(`license:${key}`, { ...r, active: true }); reactivated++; }
    }));
  }
  return { resellerKey: rKey, status: "reactivated", cascade, reactivatedLicenses: reactivated };
}

// ── New: list resellers (didn't exist as an admin action before) ────────────

export async function listResellers(db: Redis) {
  const keys: string[] = await db.smembers("all_resellers");
  const resellers = (await Promise.all(keys.map(async (key) => {
    const r = await db.get<ResellerRecord>(`reseller:${key}`);
    if (!r) return null;
    return { resellerKey: key, ...r };
  }))).filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { count: resellers.length, resellers };
}
