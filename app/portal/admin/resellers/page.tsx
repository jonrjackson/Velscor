import Link from "next/link";
import { listResellers } from "../../../../lib/admin-actions";
import { getRedis } from "../../../../lib/reseller";
import ResellersTable from "../../_components/ResellersTable";

export default async function AdminResellersPage() {
  const { resellers } = await listResellers(getRedis());

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 26 }}>Resellers</h1>
        <Link href="/admin/resellers/new" className="btn btn-primary">New reseller</Link>
      </div>
      <ResellersTable resellers={resellers as any[]} />
    </>
  );
}
