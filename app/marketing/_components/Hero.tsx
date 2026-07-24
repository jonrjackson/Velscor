export default function Hero() {
  return (
    <section className="container" style={{ padding: "96px 24px 64px", textAlign: "center" }}>
      <h1 style={{ fontSize: 48, lineHeight: 1.1, margin: "0 0 20px", letterSpacing: "-0.02em" }}>
        AI-powered email threat detection, right inside Outlook
      </h1>
      <p style={{ fontSize: 19, color: "var(--fg-muted)", maxWidth: 640, margin: "0 auto 32px" }}>
        Velscor scans every message in real time and flags phishing, spoofing, and QR-code
        scams before they reach your team &mdash; no separate inbox, no extra steps.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <a href="#pricing" className="btn btn-primary">
          Get started
        </a>
        <a href="#features" className="btn btn-secondary">
          See how it works
        </a>
      </div>
    </section>
  );
}
