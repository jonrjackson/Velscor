"use client";

import { useState } from "react";
import Link from "next/link";

type Reseller = {
  resellerKey: string;
  name: string;
  email: string;
  discountPct: number;
  active?: boolean;
};

export default function ResellersTable({ resellers }: { resellers: Reseller[] }) {
  const [hideDisabled, setHideDisabled] = useState(true);
  const visible = hideDisabled ? resellers.filter((r) => r.active !== false) : resellers;

  return (
    <>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 14, color: "var(--fg-muted)" }}>
        <input type="checkbox" checked={hideDisabled} onChange={(e) => setHideDisabled(e.target.checked)} />
        Hide disabled resellers
      </label>

      {visible.length === 0 ? (
        <p style={{ color: "var(--fg-muted)" }}>{hideDisabled ? "No active resellers." : "No resellers yet."}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Discount</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.resellerKey} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.email}</td>
                  <td style={td}>{r.discountPct}%</td>
                  <td style={td}>{r.active !== false ? "active" : "deactivated"}</td>
                  <td style={td}>
                    <Link href={`/admin/resellers/${encodeURIComponent(r.resellerKey)}`} style={{ color: "var(--accent)" }}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", color: "var(--fg-muted)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 8px" };
