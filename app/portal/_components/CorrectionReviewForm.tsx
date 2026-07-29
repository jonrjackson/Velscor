"use client";

import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";
import type { Correction } from "../../../lib/corrections";

export default function CorrectionReviewForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  submitLabel: string;
  defaultValues: Correction;
}) {
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      {state.error && <p style={{ color: "#ef4444" }}>{state.error}</p>}

      {defaultValues.reporterNote && (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--fg-muted)" }}>
            Reported by {defaultValues.reporterEmail || "unknown"}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 14 }}>&ldquo;{defaultValues.reporterNote}&rdquo;</p>
        </div>
      )}

      <Field label="Sender display name">
        <input name="senderDisplay" defaultValue={defaultValues.senderDisplay} style={inputStyle} />
      </Field>
      <Field label="Sender email">
        <input name="senderEmail" type="email" defaultValue={defaultValues.senderEmail} style={inputStyle} />
      </Field>
      <Field label="Subject">
        <input name="subject" defaultValue={defaultValues.subject} style={inputStyle} />
      </Field>
      <Field label="Authentication results (optional)">
        <textarea name="authResults" rows={2} defaultValue={defaultValues.authResults} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} />
      </Field>
      <Field label="Body excerpt (optional)">
        <textarea name="bodyExcerpt" rows={3} defaultValue={defaultValues.bodyExcerpt} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
      <Field label="Original (wrong) verdict">
        <select name="originalVerdict" required defaultValue={defaultValues.originalVerdict} style={inputStyle}>
          <option value="SAFE">SAFE</option>
          <option value="SUSPICIOUS">SUSPICIOUS</option>
          <option value="SPAM">SPAM</option>
        </select>
      </Field>
      <Field label="Correct verdict">
        <select name="correctedVerdict" required defaultValue={defaultValues.correctedVerdict} style={inputStyle}>
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
          defaultValue={defaultValues.lesson || defaultValues.reporterNote}
          placeholder="Explain the reasoning gap so it generalizes to similar future emails."
          style={{ ...inputStyle, resize: "vertical" }}
        />
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
  fontFamily: "inherit",
};
