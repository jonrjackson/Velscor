"use server";

import { redirect } from "next/navigation";
import { getStripe } from "./stripe";
import type { FormActionState } from "../app/marketing/_components/formActionState";

const PRICE_ENV_VAR: Record<string, string | undefined> = {
  user: process.env.STRIPE_PRICE_USER,
  small: process.env.STRIPE_PRICE_SMALL,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

export async function startCheckout(
  tierKey: string,
  _prevState: FormActionState,
  _formData: FormData
): Promise<FormActionState> {
  const priceId = PRICE_ENV_VAR[tierKey];
  if (!priceId) return { error: "This plan isn't available for self-serve checkout right now." };

  let url: string | null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://velscor.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://velscor.com/#pricing",
      metadata: { tier: tierKey },
    });
    url = session.url;
  } catch {
    return { error: "Something went wrong starting checkout. Please try again or contact us." };
  }

  if (!url) return { error: "Something went wrong starting checkout. Please try again or contact us." };
  redirect(url);
}
