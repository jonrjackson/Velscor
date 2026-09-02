"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";

function addDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function AdminLicenseEditForm({
  action,
  defaultValues,
  scope,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  defaultValues: {
    label?: string; contactEmail?: string; expiresAt: string | null; maxUsers?: number;
    allowedDomains?: string[]; allowedEmail?: string; type?: string;
  };
  scope: string;
}) {
  const [state, formAction] = useFormState(action, { error: null });
  const [type, setType] = useState(defaultValues.type || "trial");
  const [expiresAt, setExpiresAt] = useState(defaultValues.expiresAt ? defaultValues.expiresAt.slice(0, 10) : "");

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420, marginBottom: 32 }}>
      {state.error && <p style={{ color: "#ef4444" }}>{state.error}</p>}

      <Field label="Type">
        <select
          name="type"
          value={type}
          onChange={(e) => {
            const next = e.target.value;
            // Nudge the expiry forward on conversion so a trial's near-term
            // date doesn't silently carry over onto the new paid license.
            if (next === "paid" && type === "trial") setExpiresAt(addDays(35));
            setType(next);
          }}
          style={inputStyle}
        >
          <option value="trial">Trial</option>
          <option value="paid">Paid</option>
        </select>
      </Field>
      <Field label="Label">
        <input name="label" defaultValue={defaultValues.label} style={inputStyle} />
      </Field>
      <Field label="Contact email">
        <input name="contactEmail" type="email" defaultValue={defaultValues.contactEmail} style={inputStyle} />
      </Field>
      {scope === "org" ? (
        <>
          <Field label="Allowed domains, comma-separated">
            <input
              name="allowedDomains"
              placeholder="example.com, example.org"
              defaultValue={(defaultValues.allowedDomains || []).join(", ")}
              style={inputStyle}
            />
          </Field>
          <Field label="Max users (0 = unlimited)">
            <input name="maxUsers" type="number" min={0} defaultValue={defaultValues.maxUsers ?? 0} style={inputStyle} />
          </Field>
        </>
      ) : (
        <Field label="Allowed email">
          <input name="allowedEmail" type="email" defaultValue={defaultValues.allowedEmail} style={inputStyle} />
        </Field>
      )}
      <Field label="Expires (leave blank for never)">
        <input
          name="expiresAt"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
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
