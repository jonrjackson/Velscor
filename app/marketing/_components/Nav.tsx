import Link from "next/link";

export default function Nav() {
  return (
    <header style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}
      >
        <Link href="/" style={{ fontWeight: 700, fontSize: 18, textDecoration: "none" }}>
          Velscor
        </Link>
        <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <a href="#features" style={{ textDecoration: "none", color: "var(--fg-muted)" }}>
            Features
          </a>
          <a href="#pricing" style={{ textDecoration: "none", color: "var(--fg-muted)" }}>
            Pricing
          </a>
          <Link href="/support" style={{ textDecoration: "none", color: "var(--fg-muted)" }}>
            Support
          </Link>
          <a href="#pricing" className="btn btn-primary">
            Get started
          </a>
        </nav>
      </div>
    </header>
  );
}
