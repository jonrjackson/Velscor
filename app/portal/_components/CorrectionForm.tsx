"use client";

import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";

export default function CorrectionForm({
  action,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      {state.error && <p style={{ color: "#ef4444" }}>{state.error}</p>}

      <Field label="Sender display name">
        <input name="senderDisplay" style={inputStyle} />
      </Field>
      <Field label="Sender email">
        <input name="senderEmail" type="email" style={inputStyle} />
      </Field>
      <Field label="Subject">
        <input name="subject" style={inputStyle} />
      </Field>
      <Field label="Authentication results (optional)">
        <textarea name="authResults" rows={2} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} />
      </Field>
      <Field label="Body excerpt (optional)">
        <textarea name="bodyExcerpt" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
      <Field label="Original (wrong) verdict">
        <select name="originalVerdict" required defaultValue="" style={inputStyle}>
          <option value="" disabled>Choose one</option>
          <option value="SAFE">SAFE</option>
          <option value="SUSPICIOUS">SUSPICIOUS</option>
          <option value="SPAM">SPAM</option>
        </select>
      </Field>
      <Field label="Correct verdict">
        <select name="correctedVerdict" required defaultValue="" style={inputStyle}>
          <option value="" disabled>Choose one</option>
          <option value="SAFE">SAFE</option>
          <option value="SUSPICIOUS">SUSPICIOUS</option>
          <option value="SPAM">SPAM</option>
        </select>
      </Field>
      <Field label="Lesson">
        <textarea
          name="lesson"
          required
          rows={3}
          placeholder="Explain the reasoning gap, e.g. 'DKIM body-hash fail downstream of a security gateway is not spoofing when DMARC still passes.'"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        Add correction
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
  fontFamily: "inherit",
};
