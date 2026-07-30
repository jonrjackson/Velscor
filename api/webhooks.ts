import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { Redis } from "@upstash/redis";
import { getStripe } from "../lib/stripe";
import { getResend } from "../lib/resend";
import { createLicense, deactivateLicense, ActionError } from "../lib/admin-actions";
import { TIERS } from "../lib/license";
import type { LicenseRecord } from "../lib/license";

// Stripe requires the raw request body for signature verification —
// @vercel/node auto-parses JSON by default, so that must be disabled here.
export const config = {
  api: { bodyParser: false },
};

function redis(): Redis {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

async function buffer(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, db: Redis) {
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const tierKey = session.metadata?.tier;
  const email = session.customer_details?.email;

  if (!subscriptionId || !customerId || !tierKey || !email) {
    console.error("checkout.session.completed missing required fields", { subscriptionId, customerId, tierKey, email });
    return;
  }

  // Idempotency — Stripe may redeliver the same event more than once.
  const existingKey = await db.get<string>(`stripe_subscription:${subscriptionId}`);
  if (existingKey) return;

  if (!TIERS[tierKey]) {
    console.error(`checkout.session.completed: unknown tier "${tierKey}"`);
    return;
  }

  const scope = tierKey === "user" ? "user" : "org";
  const domain = email.split("@")[1]?.toLowerCase().trim();

  const body: Record<string, unknown> = {
    type: "paid",
    scope,
    tier: tierKey,
    contactEmail: email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  };
  if (scope === "user") body.allowedEmail = email;
  else body.allowedDomains = [domain];

  const result = (await createLicense(body, db)) as { key: string };
  await db.set(`stripe_subscription:${subscriptionId}`, result.key);

  if (scope === "user") {
    try {
      await getResend().emails.send({
        from: "Velscor <noreply@velscor.com>",
        to: email,
        subject: "Your Velscor license key",
        text: `Thanks for subscribing to Velscor Individual.\n\nYour license key: ${result.key}\n\nAdd Velscor to Outlook: https://velscor.com/install?tier=user\n\nManage your license and billing anytime at https://app.velscor.com (sign up with this same email).\n\n— Velscor`,
      });
    } catch (err) {
      console.error("Failed to email license key:", err);
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, db: Redis) {
  const key = await db.get<string>(`stripe_subscription:${subscription.id}`);
  if (key) await deactivateLicense({ key }, db);
}

// Renews every currently-paid license a reseller owns by one billing cycle.
// Only reseller-billing invoices carry a resellerKey in metadata, so direct-
// customer invoices (subscriptions) pass through untouched.
async function handleResellerInvoicePaid(invoice: Stripe.Invoice, db: Redis) {
  const resellerKey = invoice.metadata?.resellerKey;
  if (!resellerKey) return;

  const licenseKeys: string[] = await db.smembers(`reseller_licenses:${resellerKey}`);
  const renewedThrough = new Date(Date.now() + 35 * 86_400_000).toISOString();

  await Promise.all(licenseKeys.map(async (key) => {
    const record = await db.get<LicenseRecord>(`license:${key}`);
    if (!record || record.type !== "paid" || record.active === false) return;
    await db.set(`license:${key}`, { ...record, expiresAt: renewedThrough });
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") return res.status(400).json({ error: "Missing stripe-signature header" });

  const stripe = getStripe();
  const rawBody = await buffer(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  const db = redis();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, db);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db);
        break;
      case "invoice.paid":
        await handleResellerInvoicePaid(event.data.object as Stripe.Invoice, db);
        break;
      // Logged only for v1 — Stripe's own retry/dunning handles payment
      // failures, and full cancellation fires subscription.deleted (above).
      case "customer.subscription.updated":
      case "invoice.payment_failed":
        break;
      default:
        break;
    }
  } catch (err) {
    if (err instanceof ActionError) {
      // Invalid/already-resolved state — don't make Stripe retry forever.
      console.error(`Stripe webhook ${event.type} handling error:`, err.message);
    } else {
      console.error(`Stripe webhook ${event.type} unexpected error:`, err);
      return res.status(500).json({ error: "Internal error processing webhook" });
    }
  }

  return res.status(200).json({ received: true });
}
