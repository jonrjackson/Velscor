"use client";

import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";

export default function ConfirmForm({
  action,
  label,
  danger,
  variant = "secondary",
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  label: string;
  danger?: boolean;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction} style={{ display: "inline-block" }}>
      {state.error && <p style={{ color: "#ef4444", marginBottom: 8, fontSize: 14 }}>{state.error}</p>}
      <button type="submit" className={`btn btn-${variant}`} style={danger ? { color: "#ef4444" } : undefined}>
        {label}
      </button>
    </form>
  );
}
