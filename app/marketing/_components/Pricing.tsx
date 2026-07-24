import { TIERS } from "../../../lib/license";

export default function Pricing() {
  const tiers = Object.entries(TIERS);

  return (
    <section id="pricing" className="container" style={{ padding: "64px 24px" }}>
      <h2 style={{ fontSize: 30, marginBottom: 40, textAlign: "center" }}>Plans</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 24,
        }}
      >
        {tiers.map(([key, tier]) => (
          <div
            key={key}
            className="card"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ fontSize: 18, margin: "0 0 4px" }}>{tier.label}</h3>
              <p style={{ color: "var(--fg-muted)", fontSize: 14, margin: 0 }}>
                {tier.maxUsers === 0 ? "Unlimited seats" : `Up to ${tier.maxUsers} seat${tier.maxUsers === 1 ? "" : "s"}`}
              </p>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, margin: "auto 0 0" }}>Contact us for pricing</p>
            {/* TODO(v2): once pricing is finalized, add priceMonthly/priceNote to TIERS in lib/license.ts and render it here */}
            <a href="mailto:jon@jonandtrace.com" className="btn btn-secondary" style={{ justifyContent: "center" }}>
              Contact sales
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
