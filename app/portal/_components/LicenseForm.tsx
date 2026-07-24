"use client";

import { useState } from "react";

interface Tier {
  maxUsers: number;
  label: string;
}

export default function LicenseForm({
  action,
  tiers,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  tiers: Record<string, Tier>;
  submitLabel: string;
}) {
  const [scope, setScope] = useState<"org" | "user">("org");
  const [type, setType] = useState<"trial" | "paid">("trial");
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
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}
    >
      {error && <p style={{ color: "#ef4444" }}>{error}</p>}

      <Field label="Type">
        <select name="type" value={type} onChange={(e) => setType(e.target.value as any)} style={inputStyle}>
          <option value="trial">Trial</option>
          <option value="paid">Paid</option>
        </select>
      </Field>

      {type === "trial" && (
        <Field label="Trial days">
          <input name="trialDays" type="number" defaultValue={30} style={inputStyle} />
        </Field>
      )}

      <Field label="Scope">
        <select name="scope" value={scope} onChange={(e) => setScope(e.target.value as any)} style={inputStyle}>
          <option value="org">Organization (domain-based)</option>
          <option value="user">Individual user</option>
        </select>
      </Field>

      {scope === "org" ? (
        <Field label="Allowed domain(s), comma-separated">
          <input name="allowedDomains" placeholder="example.com" style={inputStyle} />
        </Field>
      ) : (
        <Field label="Allowed email">
          <input name="allowedEmail" placeholder="user@example.com" style={inputStyle} />
        </Field>
      )}

      <Field label="Tier">
        <select name="tier" defaultValue="" style={inputStyle}>
          <option value="">Custom (set seats manually)</option>
          {Object.entries(tiers).map(([key, t]) => (
            <option key={key} value={key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Max users (0 = unlimited, blank = use tier default)">
        <input name="maxUsers" type="number" style={inputStyle} />
      </Field>

      <Field label="Label">
        <input name="label" style={inputStyle} />
      </Field>

      <Field label="Contact email">
        <input name="contactEmail" type="email" style={inputStyle} />
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
