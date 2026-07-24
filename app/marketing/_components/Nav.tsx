import Link from "next/link";

export default function Nav() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--bg)",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}
      >
        <Link href="/" style={{ fontWeight: 700, fontSize: 18, textDecoration: "none" }}>
          Velscor
        </Link>
        <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Link href="/#features" style={{ textDecoration: "none", color: "var(--fg-muted)" }}>
            Features
          </Link>
          <Link href="/#pricing" style={{ textDecoration: "none", color: "var(--fg-muted)" }}>
            Pricing
          </Link>
          <Link href="/support" style={{ textDecoration: "none", color: "var(--fg-muted)" }}>
            Support
          </Link>
          <Link href="/#pricing" className="btn btn-primary">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
