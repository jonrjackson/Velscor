import type { VercelRequest, VercelResponse } from "@vercel/node";

// Stripe webhook stub — receives events and returns 200 immediately.
// Wire up real handling (signature verification + event routing) when Stripe is activated.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // TODO: Verify Stripe signature before processing in production
  // const sig = req.headers["stripe-signature"];
  // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

  // TODO: Handle relevant event types:
  //   checkout.session.completed    → create license
  //   customer.subscription.updated → update tier / extend expiresAt
  //   customer.subscription.deleted → deactivate license
  //   invoice.payment_failed        → send warning / deactivate after grace period

  return res.status(200).json({ received: true });
}
