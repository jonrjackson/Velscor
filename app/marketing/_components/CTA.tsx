export default function CTA() {
  return (
    <section className="container" style={{ padding: "64px 24px 96px", textAlign: "center" }}>
      <div
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "48px 24px",
        }}
      >
        <h2 style={{ fontSize: 28, margin: "0 0 12px" }}>Ready to protect your inbox?</h2>
        <p style={{ color: "var(--fg-muted)", margin: "0 0 24px" }}>
          Reach out and we&rsquo;ll get you set up with a trial license.
        </p>
        {/* TODO(v2): replace with a velscor.com support address once email hosting is set up */}
        <a href="mailto:jon@jonandtrace.com" className="btn btn-primary">
          Get in touch
        </a>
      </div>
    </section>
  );
}
