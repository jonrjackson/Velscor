import { redirect } from "next/navigation";
import { resolveRole } from "../../../lib/auth";
import PortalNav from "../_components/PortalNav";

const LINKS = [{ href: "/reseller", label: "My licenses" }];

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const resolved = await resolveRole();
  if (resolved.role !== "reseller") redirect("/");

  return (
    <>
      <PortalNav links={LINKS} />
      <main className="container" style={{ padding: "32px 24px" }}>
        {children}
      </main>
    </>
  );
}
