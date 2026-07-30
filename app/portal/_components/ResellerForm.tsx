"use client";

import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";

export default function ResellerForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  submitLabel: string;
  defaultValues?: { name?: string; email?: string; discountPct?: number; maxLicenses?: number; notes?: string };
}) {
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
      {state.error && <p style={{ color: "#ef4444" }}>{state.error}</p>}

      <Field label="Name">
        <input name="name" defaultValue={defaultValues?.name} required style={inputStyle} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={defaultValues?.email} required style={inputStyle} />
      </Field>
      <Field label="Discount %">
        <input name="discountPct" type="number" defaultValue={defaultValues?.discountPct ?? 0} style={inputStyle} />
      </Field>
      <Field label="Max licenses (0 = unlimited)">
        <input name="maxLicenses" type="number" defaultValue={defaultValues?.maxLicenses ?? 0} style={inputStyle} />
      </Field>
      <Field label="Notes">
        <input name="notes" defaultValue={defaultValues?.notes} style={inputStyle} />
      </Field>

      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        {submitLabel}
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
