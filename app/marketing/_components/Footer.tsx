export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", marginTop: 96 }}>
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "32px 24px",
          color: "var(--fg-muted)",
          fontSize: 14,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>&copy; {new Date().getFullYear()} Velscor. All rights reserved.</span>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="/support" style={{ textDecoration: "none" }}>
            Support
          </a>
          {/* TODO(v2): replace with a velscor.com support address once email hosting is set up */}
          <a href="mailto:jon@jonandtrace.com" style={{ textDecoration: "none" }}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
