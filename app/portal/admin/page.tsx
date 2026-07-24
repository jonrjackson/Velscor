import Link from "next/link";
import { billingReport } from "../../../lib/admin-actions";
import { getRedis } from "../../../lib/reseller";

export default async function AdminDashboard() {
  const report = await billingReport(getRedis());
  const resellerLicenses = report.resellers.reduce((sum, r) => sum + r.totalLicenses, 0);
  const totalLicenses = resellerLicenses + report.direct.totalLicenses;

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total licenses" value={totalLicenses} />
        <StatCard label="Direct licenses" value={report.direct.totalLicenses} />
        <StatCard label="Resellers" value={report.resellers.length} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/admin/licenses" className="btn btn-primary">Manage licenses</Link>
        <Link href="/admin/resellers" className="btn btn-secondary">Manage resellers</Link>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--fg-muted)", fontSize: 14 }}>{label}</div>
    </div>
  );
}
