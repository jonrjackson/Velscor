// One-off, idempotent setup script: creates the Stripe Products + recurring
// monthly Prices for the self-serve tiers. Safe to re-run (skips anything
// that already exists) — re-run against live mode when going live.
//
// Usage: node --env-file=.env.local scripts/setup-stripe.mjs
//
// Keep this list in sync with TIERS in lib/license.ts (enterprise excluded —
// no self-serve price for it).
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const TIERS = [
  { id: "velscor-individual", tierKey: "user", name: "Velscor Individual", priceMonthly: 4.99, lookupKey: "velscor-user-monthly" },
  { id: "velscor-small", tierKey: "small", name: "Velscor Small", priceMonthly: 79, lookupKey: "velscor-small-monthly" },
  { id: "velscor-business", tierKey: "business", name: "Velscor Business", priceMonthly: 299, lookupKey: "velscor-business-monthly" },
];

const envLines = [];

for (const tier of TIERS) {
  let product;
  try {
    product = await stripe.products.retrieve(tier.id);
    console.log(`Product exists: ${tier.id}`);
  } catch (err) {
    if (err.statusCode === 404 || err.code === "resource_missing") {
      product = await stripe.products.create({ id: tier.id, name: tier.name });
      console.log(`Created product: ${tier.id}`);
    } else {
      throw err;
    }
  }

  const existing = await stripe.prices.list({ lookup_keys: [tier.lookupKey], active: true, limit: 1 });
  let price;
  if (existing.data.length > 0) {
    price = existing.data[0];
    console.log(`Price exists: ${tier.lookupKey} -> ${price.id}`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(tier.priceMonthly * 100),
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: tier.lookupKey,
    });
    console.log(`Created price: ${tier.lookupKey} -> ${price.id}`);
  }

  envLines.push(`STRIPE_PRICE_${tier.tierKey.toUpperCase()}=${price.id}`);
}

console.log("\nSet these env vars:");
console.log(envLines.join("\n"));
