import Link from "next/link";

interface LicenseRow {
  key: string;
  status: string;
  type: string;
  scope: string;
  tier?: string;
  label?: string;
  allowedEmail?: string;
  allowedDomains?: string[];
  maxUsers?: number;
  expiresAt: string | null;
}

export default function LicenseTable({
  licenses,
  editHrefBase,
}: {
  licenses: LicenseRow[];
  editHrefBase: string;
}) {
  if (licenses.length === 0) {
    return <p style={{ color: "var(--fg-muted)" }}>No licenses yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            <th style={th}>Key</th>
            <th style={th}>Status</th>
            <th style={th}>Type</th>
            <th style={th}>Scope</th>
            <th style={th}>Tier</th>
            <th style={th}>Assigned to</th>
            <th style={th}>Expires</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((l) => (
            <tr key={l.key} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td, fontFamily: "monospace" }}>{l.key}</td>
              <td style={td}>
                <StatusBadge status={l.status} />
              </td>
              <td style={td}>{l.type}</td>
              <td style={td}>{l.scope}</td>
              <td style={td}>{l.tier || "—"}</td>
              <td style={td}>{l.allowedEmail || (l.allowedDomains || []).join(", ") || "—"}</td>
              <td style={td}>{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "Never"}</td>
              <td style={td}>
                <Link href={`${editHrefBase}/${encodeURIComponent(l.key)}`} style={{ color: "var(--accent)" }}>
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "active" ? "#16a34a" : status === "expired" ? "#d97706" : "#ef4444";
  return <span style={{ color, fontWeight: 600 }}>{status}</span>;
}

const th: React.CSSProperties = { padding: "10px 8px", color: "var(--fg-muted)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 8px" };
