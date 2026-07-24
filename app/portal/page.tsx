import { redirect } from "next/navigation";
import { resolveRole } from "../../lib/auth";

export default async function PortalHome() {
  const resolved = await resolveRole();

  switch (resolved.role) {
    case "admin":
      redirect("/admin");
    case "reseller":
      redirect("/reseller");
    case "customer":
      redirect("/customer");
    default:
      redirect("/not-provisioned");
  }
}
