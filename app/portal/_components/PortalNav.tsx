import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function PortalNav({ links }: { links: { href: string; label: string }[] }) {
  return (
    <header style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <span style={{ fontWeight: 700 }}>Velscor</span>
          <nav style={{ display: "flex", gap: 20 }}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} style={{ textDecoration: "none", color: "var(--fg-muted)" }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <UserButton />
      </div>
    </header>
  );
}
