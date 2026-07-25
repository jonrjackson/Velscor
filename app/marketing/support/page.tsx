export default function SupportPage() {
  return (
    <section className="container" style={{ padding: "64px 24px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Support</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
        Need help with Velscor, your license, or the Outlook add-in? Reach out and we&rsquo;ll
        get back to you.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/install" className="btn btn-secondary">
          How to add Velscor to Outlook
        </a>
        {/* TODO(v2): replace with a velscor.com support address once email hosting is set up */}
        <a href="mailto:jon@jonandtrace.com" className="btn btn-primary">
          Email support
        </a>
      </div>
    </section>
  );
}
