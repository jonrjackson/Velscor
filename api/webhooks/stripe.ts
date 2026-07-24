import type { VercelRequest, VercelResponse } from "@vercel/node";

// Stripe webhook handler — stub ready for implementation when Stripe is configured.
//
// To activate:
// 1. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to Vercel env vars
// 2. Install stripe: npm install stripe
// 3. Uncomment the verification and event handling below
// 4. Wire up create-license / update-license logic per event type

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // ── Signature verification (uncomment when Stripe is configured) ───────────
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // const sig = req.headers["stripe-signature"];
  // let event;
  // try {
  //   event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  // } catch (err: any) {
  //   return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  // }

  // ── Event handling (uncomment and implement when Stripe is configured) ─────
  // switch (event.type) {
  //
  //   case "customer.subscription.created":
  //   case "invoice.payment_succeeded":
  //     // Create or extend license based on metadata.licenseKey / metadata.scope
  //     break;
  //
  //   case "customer.subscription.deleted":
  //   case "invoice.payment_failed":
  //     // Deactivate license — call deactivate-license logic
  //     break;
  //
  //   case "customer.subscription.updated":
  //     // Handle plan change (tier upgrade/downgrade) — call update-license logic
  //     break;
  // }

  // Acknowledge receipt — Stripe requires a 2xx response within 5 seconds
  return res.status(200).json({ received: true });
}
