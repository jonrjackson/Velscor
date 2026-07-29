import { UserButton } from "@clerk/nextjs";

export default function NotProvisionedPage() {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>No access yet</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
        Your account isn&rsquo;t linked to a license or reseller account. Contact support if you
        believe this is a mistake.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, alignItems: "center" }}>
        <a href="https://velscor.com/support" className="btn btn-primary">
          Contact support
        </a>
        <UserButton />
      </div>
    </div>
  );
}
