import Link from "next/link";
import { listCorrections } from "../../../../lib/corrections";
import { getRedis } from "../../../../lib/reseller";

export default async function AdminCorrectionsPage() {
  const corrections = await listCorrections(getRedis());
  const pending = corrections.filter((c) => c.status === "pending");
  const approved = corrections.filter((c) => c.status === "approved");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 26 }}>Analysis corrections</h1>
        <Link href="/admin/corrections/new" className="btn btn-primary">Add correction</Link>
      </div>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24, maxWidth: 640 }}>
        Real cases where the email analyzer got a verdict wrong. Only <strong>approved</strong>{" "}
        corrections feed into future analyses as examples &mdash; user-reported ones need review first.
      </p>

      {pending.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: "#b45309" }}>Pending review ({pending.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
            {pending.map((c) => (
              <Link
                key={c.id}
                href={`/admin/corrections/${c.id}`}
                className="card"
                style={{ padding: 16, display: "block", textDecoration: "none", color: "inherit", border: "1px solid #b45309" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600 }}>
                    {c.senderDisplay || "?"} {c.senderEmail ? <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>&lt;{c.senderEmail}&gt;</span> : null}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                {c.subject && <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>Subject: &ldquo;{c.subject}&rdquo;</p>}
                <p style={{ margin: "10px 0 0", fontSize: 14 }}>
                  <span style={{ color: "#ef4444" }}>{c.originalVerdict}</span> &rarr; <span style={{ color: "#16a34a" }}>{c.correctedVerdict}</span>
                </p>
                {c.reporterNote && <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>&ldquo;{c.reporterNote}&rdquo;</p>}
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Approved ({approved.length})</h2>
      {approved.length === 0 ? (
        <p style={{ color: "var(--fg-muted)" }}>No approved corrections yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {approved.map((c) => (
            <Link
              key={c.id}
              href={`/admin/corrections/${c.id}`}
              className="card"
              style={{ padding: 16, display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>
                  {c.senderDisplay || "?"} {c.senderEmail ? <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>&lt;{c.senderEmail}&gt;</span> : null}
                </span>
                <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              {c.subject && <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>Subject: &ldquo;{c.subject}&rdquo;</p>}
              <p style={{ margin: "10px 0 0", fontSize: 14 }}>
                <span style={{ color: "#ef4444" }}>{c.originalVerdict}</span> &rarr; <span style={{ color: "#16a34a" }}>{c.correctedVerdict}</span>
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>{c.lesson}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
