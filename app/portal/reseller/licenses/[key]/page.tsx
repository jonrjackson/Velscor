import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveRole } from "../../../../../lib/auth";
import { listLicenses, updateLicense } from "../../../../../lib/reseller-actions";
import { ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import ResellerLicenseEditForm from "../../../_components/ResellerLicenseEditForm";
import type { FormActionState } from "../../../_components/formActionState";

async function updateLicenseAction(
  resellerKey: string,
  key: string,
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "reseller" || resolved.resellerKey !== resellerKey) return { error: "Unauthorized" };
  const body = Object.fromEntries(formData.entries());
  try {
    await updateLicense({ ...body, key }, resellerKey, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/reseller/licenses/${encodeURIComponent(key)}`);
  return { error: null };
}

export default async function ResellerLicenseDetailPage({ params }: { params: { key: string } }) {
  const resolved = await resolveRole();
  if (resolved.role !== "reseller") redirect("/");

  const key = decodeURIComponent(params.key);
  const { licenses } = await listLicenses(resolved.resellerKey, resolved.reseller.name, getRedis());
  const license = (licenses as any[]).find((l) => l.key === key);
  if (!license) notFound();

  const boundAction = updateLicenseAction.bind(null, resolved.resellerKey, key);

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 4, fontFamily: "monospace" }}>{key}</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 12 }}>
        {license.type} &middot; {license.scope} &middot; {license.status}
        {license.daysRemaining != null ? ` · ${license.daysRemaining} days remaining` : ""}
      </p>

      <a
        href={`https://velscor.com/install?tier=${license.scope === "user" ? "user" : "org"}`}
        style={{ color: "var(--accent)", fontSize: 14, textDecoration: "none", display: "inline-block", marginBottom: 24 }}
      >
        How to add Velscor to Outlook &rarr;
      </a>

      <ResellerLicenseEditForm
        action={boundAction}
        defaultValues={{ label: license.label, contactEmail: license.contactEmail, expiresAt: license.expiresAt }}
      />
    </>
  );
}
