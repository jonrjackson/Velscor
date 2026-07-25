import { getStripe } from "../../../../lib/stripe";
import { lookupLicense } from "../../../../lib/admin-actions";
import { getRedis } from "../../../../lib/reseller";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  if (!sessionId) {
    return <ErrorState message="Missing checkout session." />;
  }

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return <ErrorState message="We couldn't find that checkout session." />;
  }

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return <ErrorState message="This checkout hasn't completed yet." />;
  }

  const tierKey = session.metadata?.tier;
  const email = session.customer_details?.email;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const scope = tierKey === "user" ? "user" : "org";

  let licenseKey: string | null = null;
  if (scope === "user" && email) {
    const { results } = await lookupLicense({ email }, getRedis());
    const match = (results as any[]).find((r) => r.stripeSubscriptionId === subscriptionId) || (results as any[])[0];
    licenseKey = match?.key || null;
  }

  return (
    <section className="container" style={{ padding: "80px 24px", maxWidth: 560 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>You&rsquo;re all set</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 32 }}>
        Thanks for subscribing to Velscor. Here&rsquo;s how to get started.
      </p>

      {scope === "user" ? (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--fg-muted)" }}>Your license key</p>
          {licenseKey ? (
            <p style={{ fontFamily: "monospace", fontSize: 18, margin: 0 }}>{licenseKey}</p>
          ) : (
            <p style={{ margin: 0, color: "var(--fg-muted)" }}>
              Still provisioning &mdash; refresh this page in a moment, or check the portal shortly.
            </p>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <p style={{ margin: 0 }}>
            No key needed &mdash; open Outlook and sign in with your work email. Velscor activates
            automatically for anyone at your organization&rsquo;s domain.
          </p>
        </div>
      )}

      <a
        href={`/install?tier=${scope === "user" ? "user" : "org"}`}
        className="btn btn-primary"
        style={{ marginBottom: 24, justifyContent: "center" }}
      >
        Add Velscor to Outlook &rarr;
      </a>

      <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
        Sign in at{" "}
        <a href="https://app.velscor.com/sign-in" style={{ color: "var(--accent)" }}>
          app.velscor.com
        </a>{" "}
        with the same email to manage your license and billing going forward.
      </p>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="container" style={{ padding: "80px 24px", maxWidth: 560, textAlign: "center" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something&rsquo;s not right</h1>
      <p style={{ color: "var(--fg-muted)" }}>{message}</p>
    </section>
  );
}
