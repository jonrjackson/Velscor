import { billingReport } from "../../../../lib/admin-actions";
import { getRedis } from "../../../../lib/reseller";

export default async function AdminBillingPage() {
  const report = await billingReport(getRedis());

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Billing report</h1>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Direct</h2>
      <p style={{ color: "var(--fg-muted)", marginBottom: 32 }}>
        {report.direct.activeLicenses} active &middot; {report.direct.expiredLicenses} expired &middot;{" "}
        {report.direct.totalLicenses} total
      </p>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>By reseller</h2>
      {report.resellers.length === 0 ? (
        <p style={{ color: "var(--fg-muted)" }}>No resellers yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={th}>Reseller</th>
                <th style={th}>Active</th>
                <th style={th}>Expired</th>
                <th style={th}>Total</th>
                <th style={th}>Discount</th>
              </tr>
            </thead>
            <tbody>
              {report.resellers.map((r: any) => (
                <tr key={r.resellerKey} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.activeLicenses}</td>
                  <td style={td}>{r.expiredLicenses}</td>
                  <td style={td}>{r.totalLicenses}</td>
                  <td style={td}>{r.discountPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: "var(--fg-muted)", fontSize: 13, marginTop: 24 }}>
        Generated {new Date(report.generatedAt).toLocaleString()}
      </p>
    </>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", color: "var(--fg-muted)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 8px" };
