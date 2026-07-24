import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveRole } from "../../../lib/auth";
import { listLicenses } from "../../../lib/reseller-actions";
import { getRedis } from "../../../lib/reseller";
import LicenseTable from "../_components/LicenseTable";

export default async function ResellerHome() {
  const resolved = await resolveRole();
  if (resolved.role !== "reseller") redirect("/");

  const { licenses, reseller } = await listLicenses(resolved.resellerKey, resolved.reseller.name, getRedis());

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{reseller}&rsquo;s licenses</h1>
          <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
            {resolved.reseller.discountPct}% discount
            {resolved.reseller.maxLicenses ? ` · ${resolved.reseller.maxLicenses} license cap` : ""}
          </p>
        </div>
        <Link href="/reseller/licenses/new" className="btn btn-primary">New license</Link>
      </div>
      <LicenseTable licenses={licenses as any[]} editHrefBase="/reseller/licenses" />
    </>
  );
}
