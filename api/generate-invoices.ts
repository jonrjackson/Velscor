import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { getStripe } from "../lib/stripe";
import { RESELLER_PRICE_PER_SEAT } from "../lib/license";
import type { ResellerRecord } from "../lib/reseller";
import type { LicenseRecord } from "../lib/license";

function redis(): Redis {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

async function billableSeats(resellerKey: string, db: Redis): Promise<number> {
  const licenseKeys: string[] = await db.smembers(`reseller_licenses:${resellerKey}`);
  const licenses = await Promise.all(licenseKeys.map((key) => db.get<LicenseRecord>(`license:${key}`)));

  let seats = 0;
  for (const record of licenses) {
    if (!record) continue;
    if (record.type !== "paid") continue; // trials are unbilled
    if (record.active === false) continue;
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) continue; // already lapsed
    seats += record.scope === "org" ? (record.maxUsers || 0) : 1;
  }
  return seats;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = redis();
  const stripe = getStripe();
  const resellerKeys: string[] = await db.smembers("all_resellers");

  const results: Array<{ resellerKey: string; seats?: number; invoiceId?: string; skipped?: string }> = [];

  for (const resellerKey of resellerKeys) {
    const reseller = await db.get<ResellerRecord>(`reseller:${resellerKey}`);
    if (!reseller || reseller.active === false) {
      results.push({ resellerKey, skipped: "reseller inactive" });
      continue;
    }

    const seats = await billableSeats(resellerKey, db);
    if (seats === 0) {
      results.push({ resellerKey, seats: 0, skipped: "no billable seats" });
      continue;
    }

    let stripeCustomerId = reseller.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ name: reseller.name, email: reseller.email });
      stripeCustomerId = customer.id;
      await db.set(`reseller:${resellerKey}`, { ...reseller, stripeCustomerId });
    }

    const discountPct = reseller.discountPct || 0;
    const amountCents = Math.round(seats * RESELLER_PRICE_PER_SEAT * 100 * (1 - discountPct / 100));

    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: amountCents,
      currency: "usd",
      description: `Velscor reseller licenses — ${seats} seat${seats === 1 ? "" : "s"}${discountPct ? ` (${discountPct}% discount applied)` : ""}`,
    });

    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: 14,
      auto_advance: true,
      metadata: { resellerKey },
    });

    results.push({ resellerKey, seats, invoiceId: invoice.id });
  }

  return res.status(200).json({ generatedAt: new Date().toISOString(), results });
}
