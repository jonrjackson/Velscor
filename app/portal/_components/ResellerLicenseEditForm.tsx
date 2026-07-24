"use client";

import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";

export default function ResellerLicenseEditForm({
  action,
  defaultValues,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  defaultValues: { label?: string; contactEmail?: string; expiresAt: string | null };
}) {
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
      {state.error && <p style={{ color: "#ef4444" }}>{state.error}</p>}

      <Field label="Label">
        <input name="label" defaultValue={defaultValues.label} style={inputStyle} />
      </Field>
      <Field label="Contact email">
        <input name="contactEmail" type="email" defaultValue={defaultValues.contactEmail} style={inputStyle} />
      </Field>
      <Field label="Expires (leave blank for never)">
        <input
          name="expiresAt"
          type="date"
          defaultValue={defaultValues.expiresAt ? defaultValues.expiresAt.slice(0, 10) : ""}
          style={inputStyle}
        />
      </Field>
      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        Save changes
      </button>
    </form>
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
