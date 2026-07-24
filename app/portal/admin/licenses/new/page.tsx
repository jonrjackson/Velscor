import { redirect } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { createLicense, ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import { TIERS } from "../../../../../lib/license";
import LicenseForm from "../../../_components/LicenseForm";
import type { FormActionState } from "../../../_components/formActionState";

async function createLicenseAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };

  const body = Object.fromEntries(formData.entries());
  let key: string;
  try {
    const result = await createLicense(body, getRedis());
    key = (result as any).key;
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  redirect(`/admin/licenses/${encodeURIComponent(key)}`);
}

export default function NewLicensePage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>New license</h1>
      <LicenseForm action={createLicenseAction} tiers={TIERS} submitLabel="Create license" />
    </>
  );
}
