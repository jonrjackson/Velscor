import { redirect } from "next/navigation";
import { resolveRole } from "../../../lib/auth";
import { getSeatUsage } from "../../../lib/admin-actions";
import { getRedis } from "../../../lib/reseller";
import { getStripe } from "../../../lib/stripe";
import ConfirmForm from "../_components/ConfirmForm";
import type { FormActionState } from "../_components/formActionState";

// The customer role covers everyone at an org license's domain, but only the
// license's own contact (the purchaser) or its individual user may see the key
// or manage billing — not every coworker who signs up.
function isLicenseOwner(license: any, email: string): boolean {
  const owner = [license.contactEmail, license.allowedEmail].map((e) => String(e || "").toLowerCase().trim());
  return owner.includes(email);
}

function maskKey(key: string): string {
  return key.replace(/[A-Z0-9]{4}(?=-)/g, "••••");
}

// Bound arguments come back from the browser and can be tampered with, so this
// takes the license key and re-derives the Stripe customer server-side from the
// caller's own licenses rather than trusting a bound stripeCustomerId.
async function openBillingPortal(licenseKey: string, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "customer") return { error: "Unauthorized" };

  const license = (resolved.licenses as any[]).find((l) => l.key === licenseKey);
  if (!license || !license.stripeCustomerId || !isLicenseOwner(license, resolved.email)) return { error: "Unauthorized" };

  let url: string | null;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: license.stripeCustomerId,
      return_url: "https://app.velscor.com/customer",
    });
    url = session.url;
  } catch {
    return { error: "Couldn't open billing portal. Please try again." };
  }

  redirect(url);
}

export default async function CustomerHome() {
  const resolved = await resolveRole();
  if (resolved.role !== "customer") redirect("/");

  const db = getRedis();
  const licensesWithSeats = await Promise.all(
    (resolved.licenses as any[]).map(async (l) => ({
      key: l.key, active: l.active, expiresAt: l.expiresAt, tier: l.tier, type: l.type, scope: l.scope,
      isOwner: isLicenseOwner(l, resolved.email),
      canManageBilling: !!l.stripeCustomerId && isLicenseOwner(l, resolved.email),
      seats: l.scope === "org" ? await getSeatUsage(l.key, db) : null,
    }))
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>My license{licensesWithSeats.length > 1 ? "s" : ""}</h1>
        <a href="https://velscor.com/install" style={{ color: "var(--accent)", fontSize: 14, textDecoration: "none" }}>
          How to add Velscor to Outlook &rarr;
        </a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {licensesWithSeats.map((l) => {
          const status = l.active === false ? "deactivated" : l.expiresAt && new Date(l.expiresAt) < new Date() ? "expired" : "active";
          return (
            <div key={l.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span style={{ fontFamily: "monospace", fontSize: 15 }}>{l.isOwner ? l.key : maskKey(l.key)}</span>
                <StatusBadge status={status} />
              </div>
              <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, fontSize: 14, marginBottom: l.canManageBilling ? 16 : 0 }}>
                <dt style={{ color: "var(--fg-muted)" }}>Plan</dt>
                <dd>{l.tier || l.type}</dd>
                <dt style={{ color: "var(--fg-muted)" }}>Expires</dt>
                <dd>{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "Never"}</dd>
                {l.seats && (
                  <>
                    <dt style={{ color: "var(--fg-muted)" }}>Seats used</dt>
                    <dd>{l.seats.unlimited ? `${l.seats.used} (unlimited)` : `${l.seats.used} / ${l.seats.maxUsers}`}</dd>
                  </>
                )}
              </dl>
              {l.canManageBilling && (
                <ConfirmForm action={openBillingPortal.bind(null, l.key)} label="Manage billing" variant="secondary" />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "active" ? "#16a34a" : status === "expired" ? "#d97706" : "#ef4444";
  return <span style={{ color, fontWeight: 600 }}>{status}</span>;
}
