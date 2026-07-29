import Link from "next/link";
import { revalidatePath } from "next/cache";
import { resolveRole } from "../../../../lib/auth";
import { listCorrections, deleteCorrection } from "../../../../lib/corrections";
import { ActionError } from "../../../../lib/admin-actions";
import { getRedis } from "../../../../lib/reseller";
import ConfirmForm from "../../_components/ConfirmForm";
import type { FormActionState } from "../../_components/formActionState";

async function deleteCorrectionAction(id: string, _prevState: FormActionState): Promise<FormActionState> {
  "use server";
  const resolved = await resolveRole();
  if (resolved.role !== "admin") return { error: "Unauthorized" };
  try {
    await deleteCorrection(id, getRedis());
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/corrections");
  return { error: null };
}

export default async function AdminCorrectionsPage() {
  const corrections = await listCorrections(getRedis());

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 26 }}>Analysis corrections</h1>
        <Link href="/admin/corrections/new" className="btn btn-primary">Add correction</Link>
      </div>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24, maxWidth: 640 }}>
        Real cases where the email analyzer got a verdict wrong. These feed into every future
        analysis as examples — keep this list small and high-signal (most recent {20} are kept).
      </p>
      {corrections.length === 0 ? (
        <p style={{ color: "var(--fg-muted)" }}>No corrections yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {corrections.map((c) => (
            <div key={c.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>
                  {c.senderDisplay || "?"} {c.senderEmail ? <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>&lt;{c.senderEmail}&gt;</span> : null}
                </span>
                <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              {c.subject && <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>Subject: &ldquo;{c.subject}&rdquo;</p>}
              <p style={{ margin: "10px 0 0", fontSize: 14 }}>
                <span style={{ color: "#ef4444" }}>{c.originalVerdict}</span> &rarr; <span style={{ color: "#16a34a" }}>{c.correctedVerdict}</span>
              </p>
              <p style={{ margin: "6px 0 12px", fontSize: 14, color: "var(--fg-muted)" }}>{c.lesson}</p>
              <ConfirmForm action={deleteCorrectionAction.bind(null, c.id)} label="Delete" danger />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
