import Link from "next/link";
import { listLicenses, listResellers } from "../../../../lib/admin-actions";
import { getRedis } from "../../../../lib/reseller";
import LicenseTable from "../../_components/LicenseTable";

export default async function AdminLicensesPage() {
  const db = getRedis();
  const [{ licenses }, { resellers }] = await Promise.all([listLicenses(db), listResellers(db)]);

  const resellerNames = new Map((resellers as any[]).map((r) => [r.resellerKey, r.name]));
  const withSource = (licenses as any[]).map((l) => ({
    ...l,
    resellerName: l.resellerId ? resellerNames.get(l.resellerId) || l.resellerId : "",
  }));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 26 }}>Licenses</h1>
        <Link href="/admin/licenses/new" className="btn btn-primary">New license</Link>
      </div>
      <LicenseTable licenses={withSource} editHrefBase="/admin/licenses" showSource />
    </>
  );
}
