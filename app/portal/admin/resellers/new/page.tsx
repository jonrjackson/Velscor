import { redirect } from "next/navigation";
import { resolveRole } from "../../../../../lib/auth";
import { createReseller, ActionError } from "../../../../../lib/admin-actions";
import { getRedis } from "../../../../../lib/reseller";
import ResellerForm from "../../../_components/ResellerForm";

async function createResellerAction(formData: FormData) {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") throw new Error("Unauthorized");

  const body = Object.fromEntries(formData.entries());
  try {
    const result = await createReseller(body, getRedis());
    redirect(`/admin/resellers/${encodeURIComponent((result as any).resellerKey)}`);
  } catch (err) {
    if (err instanceof ActionError) throw new Error(err.message);
    throw err;
  }
}

export default function NewResellerPage() {
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>New reseller</h1>
      <ResellerForm action={createResellerAction} submitLabel="Create reseller" />
    </>
  );
}
