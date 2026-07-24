import { redirect } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { createReseller, ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import ResellerForm from "../../../_components/ResellerForm";
import type { FormActionState } from "../../../_components/formActionState";

async function createResellerAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };

  const body = Object.fromEntries(formData.entries());
  let resellerKey: string;
  try {
    const result = await createReseller(body, getRedis());
    resellerKey = (result as any).resellerKey;
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  redirect(`/admin/resellers/${encodeURIComponent(resellerKey)}`);
}

export default function NewResellerPage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>New reseller</h1>
      <ResellerForm action={createResellerAction} submitLabel="Create reseller" />
    </>
  );
}
