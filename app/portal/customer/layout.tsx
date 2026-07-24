import { redirect } from "next/navigation";
import { resolveRole } from "../../../lib/auth";
import PortalNav from "../_components/PortalNav";

const LINKS = [{ href: "/customer", label: "My license" }];

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const resolved = await resolveRole();
  if (resolved.role !== "customer") redirect("/");

  return (
    <>
      <PortalNav links={LINKS} />
      <main className="container" style={{ padding: "32px 24px" }}>
        {children}
      </main>
    </>
  );
}
