import { redirect } from "next/navigation";
import { resolveRole } from "../../../lib/auth";
import { getSeatUsage } from "../../../lib/admin-actions";
import { getRedis } from "../../../lib/reseller";

export default async function CustomerHome() {
  const resolved = await resolveRole();
  if (resolved.role !== "customer") redirect("/");

  const db = getRedis();
  const licensesWithSeats = await Promise.all(
    (resolved.licenses as any[]).map(async (l) => ({
      ...l,
      seats: l.scope === "org" ? await getSeatUsage(l.key, db) : null,
    }))
  );

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>My license{licensesWithSeats.length > 1 ? "s" : ""}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {licensesWithSeats.map((l) => {
          const status = l.active === false ? "deactivated" : l.expiresAt && new Date(l.expiresAt) < new Date() ? "expired" : "active";
          return (
            <div key={l.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span style={{ fontFamily: "monospace", fontSize: 15 }}>{l.key}</span>
                <StatusBadge status={status} />
              </div>
              <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, fontSize: 14 }}>
                <dt style={{ color: "var(--fg-muted)" }}>Plan</dt>
                <dd>{l.tier || l.type}</dd>
                <dt style={{ color: "var(--fg-muted)" }}>Expires</dt>
                <dd>{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "Never"}</dd>
                {l.seats && (
                  <>
                    <dt style={{ color: "var(--fg-muted)" }}>Seats used</dt>
                    <dd>{l.seats.unlimited ? `${l.seats.used} (unlimited)` : `${l.seats.used} / ${l.seats.maxUsers}`}</dd>
                  </>
                )}
              </dl>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "active" ? "#16a34a" : status === "expired" ? "#d97706" : "#ef4444";
  return <span style={{ color, fontWeight: 600 }}>{status}</span>;
}
