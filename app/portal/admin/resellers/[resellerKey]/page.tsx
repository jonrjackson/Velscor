import { redirect, notFound } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { listResellers, updateReseller, deactivateReseller, ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import ResellerForm from "../../../_components/ResellerForm";

async function updateResellerAction(resellerKey: string, formData: FormData) {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") throw new Error("Unauthorized");
  const body = Object.fromEntries(formData.entries());
  try {
    await updateReseller({ ...body, resellerKey }, getRedis());
    redirect(`/admin/resellers/${encodeURIComponent(resellerKey)}`);
  } catch (err) {
    if (err instanceof ActionError) throw new Error(err.message);
    throw err;
  }
}

async function toggleActiveAction(resellerKey: string, active: boolean) {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") throw new Error("Unauthorized");
  if (active) {
    await updateReseller({ resellerKey, active: true }, getRedis());
  } else {
    await deactivateReseller({ resellerKey, cascade: false }, getRedis());
  }
  redirect(`/admin/resellers/${encodeURIComponent(resellerKey)}`);
}

export default async function AdminResellerDetailPage({ params }: { params: { resellerKey: string } }) {
  const resolved = await resolveRole();
  if (resolved.role !== "admin") redirect("/");

  const resellerKey = decodeURIComponent(params.resellerKey);
  const { resellers } = await listResellers(getRedis());
  const reseller = (resellers as any[]).find((r) => r.resellerKey === resellerKey);
  if (!reseller) notFound();

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>{reseller.name}</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24, fontFamily: "monospace" }}>{resellerKey}</p>

      <ResellerForm
        action={updateResellerAction.bind(null, resellerKey)}
        submitLabel="Save changes"
        defaultValues={reseller}
      />

      <div style={{ marginTop: 24 }}>
        {reseller.active ? (
          <form action={toggleActiveAction.bind(null, resellerKey, false)}>
            <button type="submit" className="btn btn-secondary" style={{ color: "#ef4444" }}>Deactivate</button>
          </form>
        ) : (
          <form action={toggleActiveAction.bind(null, resellerKey, true)}>
            <button type="submit" className="btn btn-primary">Reactivate</button>
          </form>
        )}
      </div>
    </>
  );
}
