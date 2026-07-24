import { redirect, notFound } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { listResellers, updateReseller, deactivateReseller, ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import ResellerForm from "../../../_components/ResellerForm";
import ConfirmForm from "../../../_components/ConfirmForm";
import type { FormActionState } from "../../../_components/formActionState";

async function updateResellerAction(resellerKey: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  const body = Object.fromEntries(formData.entries());
  try {
    await updateReseller({ ...body, resellerKey }, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  redirect(`/admin/resellers/${encodeURIComponent(resellerKey)}`);
}

async function toggleActiveAction(resellerKey: string, active: boolean, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  try {
    if (active) {
      await updateReseller({ resellerKey, active: true }, getRedis());
    } else {
      await deactivateReseller({ resellerKey, cascade: false }, getRedis());
    }
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
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
          <ConfirmForm action={toggleActiveAction.bind(null, resellerKey, false)} label="Deactivate" danger />
        ) : (
          <ConfirmForm action={toggleActiveAction.bind(null, resellerKey, true)} label="Reactivate" variant="primary" />
        )}
      </div>
    </>
  );
}
