import Link from "next/link";
import { listLicenses } from "../../../../lib/admin-actions";
import { getRedis } from "../../../../lib/reseller";
import LicenseTable from "../../_components/LicenseTable";

export default async function AdminLicensesPage() {
  const { licenses } = await listLicenses(getRedis());

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 26 }}>Licenses</h1>
        <Link href="/admin/licenses/new" className="btn btn-primary">New license</Link>
      </div>
      <LicenseTable licenses={licenses as any[]} editHrefBase="/admin/licenses" />
    </>
  );
}
