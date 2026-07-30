"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import type { FormActionState } from "./formActionState";

export default function ReactivateResellerForm({
  action,
}: {
  action: (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const [state, formAction] = useFormState(action, { error: null });
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div>
        {state.error && <p style={{ color: "#ef4444", marginBottom: 8, fontSize: 14 }}>{state.error}</p>}
        <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
          Reactivate
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, maxWidth: 360 }}>
      <p style={{ marginBottom: 12, fontSize: 14 }}>Also reactivate this reseller&apos;s licenses?</p>
      <form action={formAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" name="cascade" value="true" className="btn btn-primary">
          Reseller + licenses
        </button>
        <button type="submit" name="cascade" value="false" className="btn btn-secondary">
          Reseller only
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </form>
    </div>
  );
}
