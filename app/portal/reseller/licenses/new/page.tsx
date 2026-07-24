import { redirect } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { createLicense } from "../../../../../lib/reseller-actions";
import { ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import { TIERS } from "../../../../../lib/license";
import LicenseForm from "../../../_components/LicenseForm";

async function createLicenseAction(formData: FormData) {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "reseller") throw new Error("Unauthorized");

  const body = Object.fromEntries(formData.entries());
  try {
    const result = await createLicense(
      body,
      resolved.resellerKey,
      resolved.reseller.name,
      resolved.reseller.maxLicenses ?? 0,
      getRedis()
    );
    redirect(`/reseller/licenses/${encodeURIComponent((result as any).key)}`);
  } catch (err) {
    if (err instanceof ActionError) throw new Error(err.message);
    throw err;
  }
}

export default function NewResellerLicensePage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>New license</h1>
      <LicenseForm action={createLicenseAction} tiers={TIERS} submitLabel="Create license" />
    </>
  );
}
