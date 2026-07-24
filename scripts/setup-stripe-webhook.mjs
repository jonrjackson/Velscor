// Creates the Stripe webhook endpoint via the API and pipes the signing
// secret directly into `vercel env add` without ever printing it — the
// secret is only readable once, at creation time.
//
// Usage: node --env-file=.env.local scripts/setup-stripe-webhook.mjs
import Stripe from "stripe";
import { spawn } from "node:child_process";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const endpoint = await stripe.webhookEndpoints.create({
  url: "https://velscor.com/api/webhooks",
  enabled_events: ["checkout.session.completed", "customer.subscription.deleted"],
  description: "Velscor checkout + subscription lifecycle",
});

console.log(`Created webhook endpoint: ${endpoint.id}`);
console.log(`URL: ${endpoint.url}`);
console.log(`Events: ${endpoint.enabled_events.join(", ")}`);

await new Promise((resolve, reject) => {
  const child = spawn(
    "vercel",
    ["env", "add", "STRIPE_WEBHOOK_SECRET", "production,preview", "--yes"],
    { stdio: ["pipe", "inherit", "inherit"] }
  );
  child.stdin.write(endpoint.secret);
  child.stdin.end();
  child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`vercel env add exited ${code}`))));
});

console.log("STRIPE_WEBHOOK_SECRET set in Vercel (Production, Preview).");
