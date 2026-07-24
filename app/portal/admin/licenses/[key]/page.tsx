import { redirect, notFound } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import {
  lookupLicense, updateLicense, deactivateLicense, deleteLicense, rotateKey, getSeatUsage, ActionError,
} from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";

async function requireAdmin() {
  const resolved = await resolveRole();
  if (resolved.role !== "admin") throw new Error("Unauthorized");
}

async function deactivateAction(key: string) {
  "use server";
  await requireAdmin();
  await deactivateLicense({ key }, getRedis());
  redirect(`/admin/licenses/${encodeURIComponent(key)}`);
}

async function reactivateAction(key: string) {
  "use server";
  await requireAdmin();
  await updateLicense({ key, active: true }, getRedis());
  redirect(`/admin/licenses/${encodeURIComponent(key)}`);
}

async function deleteAction(key: string) {
  "use server";
  await requireAdmin();
  await deleteLicense({ key }, getRedis());
  redirect("/admin/licenses");
}

async function rotateAction(key: string) {
  "use server";
  await requireAdmin();
  const result = await rotateKey({ key }, getRedis());
  redirect(`/admin/licenses/${encodeURIComponent((result as any).newKey)}`);
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
        <dt style={{ color: "var(--fg-muted)" }}>Allowed</dt>
        <dd>{license.allowedEmail || (license.allowedDomains || []).join(", ") || "—"}</dd>
        <dt style={{ color: "var(--fg-muted)" }}>Expires</dt>
        <dd>{license.expiresAt ? new Date(license.expiresAt).toLocaleString() : "Never"}</dd>
        {seats && (
          <>
            <dt style={{ color: "var(--fg-muted)" }}>Seats used</dt>
            <dd>{seats.unlimited ? `${seats.used} (unlimited)` : `${seats.used} / ${seats.maxUsers}`}</dd>
          </>
        )}
      </dl>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {license.active === false ? (
          <form action={reactivateAction.bind(null, key)}>
            <button type="submit" className="btn btn-primary">Reactivate</button>
          </form>
        ) : (
          <form action={deactivateAction.bind(null, key)}>
            <button type="submit" className="btn btn-secondary">Deactivate</button>
          </form>
        )}
        <form action={rotateAction.bind(null, key)}>
          <button type="submit" className="btn btn-secondary">Rotate key</button>
        </form>
        <form action={deleteAction.bind(null, key)}>
          <button type="submit" className="btn btn-secondary" style={{ color: "#ef4444" }}>Delete</button>
        </form>
      </div>
    </>
  );
}
