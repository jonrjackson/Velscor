import { redirect } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { addCorrection } from "../../../../../lib/corrections";
import { ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import CorrectionForm from "../../../_components/CorrectionForm";
import type { FormActionState } from "../../../_components/formActionState";

async function createCorrectionAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };

  const body = Object.fromEntries(formData.entries());
  try {
    await addCorrection(body, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  redirect("/admin/corrections");
}

export default function NewCorrectionPage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>Add correction</h1>
      <CorrectionForm action={createCorrectionAction} />
    </>
  );
}
