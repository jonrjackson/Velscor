"use client";

import { useFormState } from "react-dom";
import { submitSupportRequest, type SupportFormState } from "../../../lib/support-actions";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--fg)",
  fontSize: 14,
  fontFamily: "inherit",
};

export default function ContactForm() {
  const [state, formAction] = useFormState<SupportFormState, FormData>(submitSupportRequest, { error: null });

  if (state.success) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p style={{ margin: 0 }}>Thanks — your message is on its way. We&rsquo;ll get back to you soon.</p>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
      {state.error && <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>{state.error}</p>}

      {/* Honeypot — hidden from real users, bots often fill every field. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
        <span style={{ color: "var(--fg-muted)" }}>Name</span>
        <input name="name" style={inputStyle} />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
        <span style={{ color: "var(--fg-muted)" }}>Email</span>
        <input name="email" type="email" required style={inputStyle} />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
        <span style={{ color: "var(--fg-muted)" }}>Message</span>
        <textarea name="message" required rows={5} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
      </label>

      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        Send message
      </button>
    </form>
  );
}
