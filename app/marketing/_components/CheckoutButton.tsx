"use client";

import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";

export default function CheckoutButton({
  action,
  label,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
  label: string;
}) {
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction}>
      {state.error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 8 }}>{state.error}</p>}
      <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
        {label}
      </button>
    </form>
  );
}
