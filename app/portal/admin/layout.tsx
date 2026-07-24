import { redirect } from "next/navigation";
import { resolveRole } from "../../../lib/auth";
import PortalNav from "../_components/PortalNav";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/licenses", label: "Licenses" },
  { href: "/admin/resellers", label: "Resellers" },
  { href: "/admin/billing", label: "Billing" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const resolved = await resolveRole();
  if (resolved.role !== "admin") redirect("/");

  return (
    <>
      <PortalNav links={LINKS} />
      <main className="container" style={{ padding: "32px 24px" }}>
        {children}
      </main>
    </>
  );
}
