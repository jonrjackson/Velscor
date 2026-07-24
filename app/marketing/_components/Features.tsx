const FEATURES = [
  {
    title: "Real-time AI verdicts",
    body: "Every message is analyzed by Claude and classified as safe, suspicious, or spam &mdash; directly in the Outlook reading pane.",
  },
  {
    title: "Spoofing detection",
    body: "Checks SPF, DKIM, and DMARC results alongside From/Return-Path mismatches to catch senders impersonating trusted domains.",
  },
  {
    title: "QR-code phishing detection",
    body: "Flags emails using QR codes as a phishing tactic &mdash; a growing attack vector that most filters miss entirely.",
  },
  {
    title: "Per-org and per-user licensing",
    body: "Roll out to your whole domain or license individual users, with seat limits enforced automatically.",
  },
];

export default function Features() {
  return (
    <section id="features" className="container" style={{ padding: "64px 24px" }}>
      <h2 style={{ fontSize: 30, marginBottom: 40, textAlign: "center" }}>What Velscor catches</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 24,
        }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: 17, margin: "0 0 8px" }}>{f.title}</h3>
            <p style={{ color: "var(--fg-muted)", fontSize: 15, margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
