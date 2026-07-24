import Link from "next/link";
import { listResellers } from "../../../../lib/admin-actions";
import { getRedis } from "../../../../lib/reseller";

export default async function AdminResellersPage() {
  const { resellers } = await listResellers(getRedis());

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 26 }}>Resellers</h1>
        <Link href="/admin/resellers/new" className="btn btn-primary">New reseller</Link>
      </div>
      {resellers.length === 0 ? (
        <p style={{ color: "var(--fg-muted)" }}>No resellers yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Discount</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(resellers as any[]).map((r) => (
                <tr key={r.resellerKey} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.email}</td>
                  <td style={td}>{r.discountPct}%</td>
                  <td style={td}>{r.active ? "active" : "deactivated"}</td>
                  <td style={td}>
                    <Link href={`/admin/resellers/${encodeURIComponent(r.resellerKey)}`} style={{ color: "var(--accent)" }}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", color: "var(--fg-muted)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 8px" };
