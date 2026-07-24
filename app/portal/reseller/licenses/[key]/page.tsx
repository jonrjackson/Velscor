import { redirect, notFound } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { listLicenses, updateLicense } from "../../../../../lib/reseller-actions";
import { ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";

async function updateLicenseAction(resellerKey: string, key: string, formData: FormData) {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "reseller" || resolved.resellerKey !== resellerKey) throw new Error("Unauthorized");
  const body = Object.fromEntries(formData.entries());
  try {
    await updateLicense({ ...body, key }, resellerKey, getRedis());
    redirect(`/reseller/licenses/${encodeURIComponent(key)}`);
  } catch (err) {
    if (err instanceof ActionError) throw new Error(err.message);
    throw err;
  }
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
      <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
        {license.type} &middot; {license.scope} &middot; {license.status}
        {license.daysRemaining != null ? ` · ${license.daysRemaining} days remaining` : ""}
      </p>

      <form action={boundAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
        <Field label="Label">
          <input name="label" defaultValue={license.label} style={inputStyle} />
        </Field>
        <Field label="Contact email">
          <input name="contactEmail" type="email" defaultValue={license.contactEmail} style={inputStyle} />
        </Field>
        <Field label="Expires (leave blank for never)">
          <input
            name="expiresAt"
            type="date"
            defaultValue={license.expiresAt ? license.expiresAt.slice(0, 10) : ""}
            style={inputStyle}
          />
        </Field>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Save changes
        </button>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--fg)",
  fontSize: 14,
};
