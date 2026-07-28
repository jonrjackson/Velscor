import ContactForm from "../_components/ContactForm";

export default function SupportPage() {
  return (
    <section className="container" style={{ padding: "64px 24px", maxWidth: 640 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Support</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
        Need help with Velscor, your license, or the Outlook add-in? Send us a message and
        we&rsquo;ll get back to you.
      </p>

      <div style={{ marginBottom: 24 }}>
        <a href="/install" className="btn btn-secondary">
          How to add Velscor to Outlook
        </a>
      </div>

      <ContactForm />
    </section>
  );
}
