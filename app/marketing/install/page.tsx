import InstallGuide from "./_components/InstallGuide";

export default function InstallPage({
  searchParams,
}: {
  searchParams: { tier?: string };
}) {
  const initialTab = searchParams.tier === "user" ? "individual" : searchParams.tier ? "org" : "individual";

  return (
    <section className="container" style={{ padding: "64px 24px", maxWidth: 720 }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>Add Velscor to Outlook</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 40 }}>
        Pick the option that matches how you&rsquo;re setting this up.
      </p>
      <InstallGuide initialTab={initialTab} />
    </section>
  );
}
