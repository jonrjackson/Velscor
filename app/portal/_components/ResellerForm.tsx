"use client";

import { useState } from "react";

export default function ResellerForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  defaultValues?: { name?: string; email?: string; discountPct?: number; maxLicenses?: number; notes?: string };
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          await action(formData);
        } catch (err: any) {
          setError(err?.message || "Something went wrong");
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}
    >
      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      <Field label="Name">
        <input name="name" defaultValue={defaultValues?.name} required style={inputStyle} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={defaultValues?.email} required style={inputStyle} />
      </Field>
      <Field label="Discount %">
        <input name="discountPct" type="number" defaultValue={defaultValues?.discountPct ?? 35} style={inputStyle} />
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
