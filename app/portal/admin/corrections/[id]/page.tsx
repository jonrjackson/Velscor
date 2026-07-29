import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveRole } from "../../../../../lib/auth";
import { getCorrection, approveCorrection, updateCorrection, deleteCorrection } from "../../../../../lib/corrections";
import { ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import CorrectionReviewForm from "../../../_components/CorrectionReviewForm";
import ConfirmForm from "../../../_components/ConfirmForm";
import type { FormActionState } from "../../../_components/formActionState";

async function approveAction(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  const body = Object.fromEntries(formData.entries());
  try {
    await approveCorrection(id, body, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/corrections");
  redirect("/admin/corrections");
}

async function saveAction(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  const body = Object.fromEntries(formData.entries());
  try {
    await updateCorrection(id, body, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/admin/corrections/${id}`);
  return { error: null };
}

async function deleteAction(id: string, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  try {
    await deleteCorrection(id, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  redirect("/admin/corrections");
}

export default async function AdminCorrectionDetailPage({ params }: { params: { id: string } }) {
  const correction = await getCorrection(params.id, getRedis());
  if (!correction) notFound();

  const isPending = correction.status === "pending";

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>
        {isPending ? "Review correction" : "Edit correction"}
      </h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
        {isPending ? "Pending — not yet feeding the analyzer." : "Approved — currently feeding every analysis."}
      </p>

      <CorrectionReviewForm
        action={(isPending ? approveAction : saveAction).bind(null, correction.id)}
        submitLabel={isPending ? "Approve" : "Save changes"}
        defaultValues={correction}
      />

      <div style={{ marginTop: 24 }}>
        <ConfirmForm action={deleteAction.bind(null, correction.id)} label={isPending ? "Reject" : "Delete"} danger />
      </div>
    </>
  );
}
