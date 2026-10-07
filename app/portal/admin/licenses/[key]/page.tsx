import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveRole } from "../../../../../lib/auth";
import {
  lookupLicense, updateLicense, deactivateLicense, deleteLicense, rotateKey, getSeatUsage, listResellers, ActionError,
} from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import ConfirmForm from "../../../_components/ConfirmForm";
import AdminLicenseEditForm from "../../../_components/AdminLicenseEditForm";
import type { FormActionState } from "../../../_components/formActionState";

async function updateAction(key: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  const body = Object.fromEntries(formData.entries());
  try {
    await updateLicense({ ...body, key }, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/admin/licenses/${encodeURIComponent(key)}`);
  return { error: null };
}

async function deactivateAction(key: string, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  try {
    await deactivateLicense({ key }, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/admin/licenses/${encodeURIComponent(key)}`);
  return { error: null };
}

async function reactivateAction(key: string, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  try {
    await updateLicense({ key, active: true }, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/admin/licenses/${encodeURIComponent(key)}`);
  return { error: null };
}

async function deleteAction(key: string, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  try {
    await deleteLicense({ key }, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  redirect("/admin/licenses");
}

async function rotateAction(key: string, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  let newKey: string;
  try {
    const result = await rotateKey({ key }, getRedis());
    newKey = (result as any).newKey;
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  redirect(`/admin/licenses/${encodeURIComponent(newKey)}`);
}

export default async function AdminLicenseDetailPage({ params }: { params: { key: string } }) {
  const resolved = await resolveRole();
  if (resolved.role !== "admin") redirect("/");

  const key = decodeURIComponent(params.key);
  const db = getRedis();
  const { results } = await lookupLicense({ key }, db);
  const license = results[0] as any;
  if (!license) notFound();

  const seats = license.scope === "org" ? await getSeatUsage(key, db) : null;
  const { resellers } = await listResellers(db);
  const resellerOptions = resellers.map((r) => ({ resellerKey: r.resellerKey, name: r.name, active: r.active }));
  const resellerName = resellers.find((r) => r.resellerKey === license.resellerId)?.name;

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 4, fontFamily: "monospace" }}>{key}</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
        {license.type} &middot; {license.scope} &middot; {license.active === false ? "deactivated" : "active"}
      </p>

      <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 10, fontSize: 14, marginBottom: 32 }}>
        <dt style={{ color: "var(--fg-muted)" }}>Tier</dt>
        <dd>{license.tier || "custom"}</dd>
        <dt style={{ color: "var(--fg-muted)" }}>Label</dt>
        <dd>{license.label || "—"}</dd>
        <dt style={{ color: "var(--fg-muted)" }}>Contact</dt>
        <dd>{license.contactEmail || "—"}</dd>
        <dt style={{ color: "var(--fg-muted)" }}>Source</dt>
        <dd>{license.resellerId ? `Reseller: ${resellerName || license.resellerId}` : "Direct"}</dd>
        {seats && (
          <>
            <dt style={{ color: "var(--fg-muted)" }}>Seats used</dt>
            <dd>{seats.unlimited ? `${seats.used} (unlimited)` : `${seats.used} / ${seats.maxUsers}`}</dd>
          </>
        )}
      </dl>

      {/* Keyed so the form remounts when a reseller assignment changes the expiry server-side */}
      <AdminLicenseEditForm
        key={`${license.resellerId || ""}|${license.expiresAt || ""}`}
        action={updateAction.bind(null, key)}
        defaultValues={{
          label: license.label, contactEmail: license.contactEmail, expiresAt: license.expiresAt, maxUsers: license.maxUsers,
          allowedDomains: license.allowedDomains, allowedEmail: license.allowedEmail, type: license.type,
          resellerId: license.resellerId,
        }}
        scope={license.scope}
        resellers={resellerOptions}
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        {license.active === false ? (
          <ConfirmForm action={reactivateAction.bind(null, key)} label="Reactivate" variant="primary" />
        ) : (
          <ConfirmForm action={deactivateAction.bind(null, key)} label="Deactivate" />
        )}
        <ConfirmForm action={rotateAction.bind(null, key)} label="Rotate key" />
        <ConfirmForm action={deleteAction.bind(null, key)} label="Delete" danger />
      </div>
    </>
  );
}
