export default function TermsPage() {
  return (
    <section className="container" style={{ padding: "64px 24px", maxWidth: 720 }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: "var(--fg-muted)", marginBottom: 40, fontSize: 14 }}>Last updated: July 29, 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: 15, lineHeight: 1.7, color: "var(--fg)" }}>
        <div className="card" style={{ padding: 20, background: "#2a1a0d", borderColor: "#92400e" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#fcd34d" }}>
            <strong>Draft placeholder:</strong> this page has not been reviewed by a lawyer. The
            bracketed fields below (legal entity name, governing jurisdiction) need to be filled in,
            and the whole document should get legal review before being relied on.
          </p>
        </div>

        <Section title="1. Acceptance of terms">
          By accessing or using Velscor (the &ldquo;Service&rdquo;), including the Outlook add-in, the
          website, and the account portal, you agree to be bound by these Terms of Service. If you are
          using the Service on behalf of an organization, you represent that you have authority to bind
          that organization, and &ldquo;you&rdquo; refers to both you and the organization.
        </Section>

        <Section title="2. Description of the service">
          Velscor uses AI to analyze emails and flag characteristics associated with spam, phishing, or
          scams, and returns a verdict (Safe, Suspicious, or Spam) with a confidence level and
          explanation. The Service is provided as an informational aid to help you evaluate email risk
          &mdash; it is not a firewall, spam filter, or security control that blocks, quarantines, or
          removes any email, link, or attachment.
        </Section>

        <Section title="3. Your responsibility &mdash; no guarantee against threats">
          <strong>The Service is advisory only.</strong> AI-based analysis can be wrong in either
          direction: it may mark a malicious email as Safe (a false negative) or a legitimate email as
          Suspicious or Spam (a false positive). A &ldquo;Safe&rdquo; verdict is not a guarantee that an
          email, its links, or its attachments are free of malware, phishing, or fraud. You remain solely
          responsible for the decision to open, click, download, reply to, or act on any email,
          regardless of any verdict shown by the Service. Velscor is a decision aid, not a substitute for
          your own judgment, your organization&rsquo;s security policies, or other security tools.
        </Section>

        <Section title="4. Disclaimer of warranties">
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES
          OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION ANY IMPLIED
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR
          ACCURACY. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY
          VERDICT PRODUCED BY THE SERVICE WILL BE ACCURATE OR COMPLETE.
        </Section>

        <Section title="5. Limitation of liability">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, VELSCOR AND ITS OWNERS, EMPLOYEES, AND CONTRACTORS
          WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          OR ANY LOSS OF DATA, REVENUE, OR PROFITS, ARISING FROM OR RELATED TO YOUR USE OF (OR INABILITY
          TO USE) THE SERVICE, INCLUDING ANY HARM RESULTING FROM A MALICIOUS EMAIL THAT THE SERVICE
          FAILED TO FLAG, OR A LEGITIMATE EMAIL THE SERVICE INCORRECTLY FLAGGED. OUR TOTAL LIABILITY FOR
          ANY CLAIM ARISING FROM THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS
          BEFORE THE CLAIM AROSE.
        </Section>

        <Section title="6. Accounts, licenses, and seats">
          Individual licenses are tied to a single email address; Small/Business/Enterprise licenses
          are tied to your organization&rsquo;s email domain and cover up to the seat count for your
          plan. You&rsquo;re responsible for keeping your license key and account credentials
          confidential and for all activity under your account.
        </Section>

        <Section title="7. Subscriptions and billing">
          Paid plans are billed on a recurring monthly subscription via Stripe and renew automatically
          until cancelled. You can cancel anytime from the account portal&rsquo;s billing management
          page; your license stays active through the end of the period you&rsquo;ve already paid for.
          We don&rsquo;t offer refunds for partial billing periods except where required by law.
        </Section>

        <Section title="8. Acceptable use">
          You agree not to misuse the Service &mdash; including attempting to circumvent license or
          seat limits, submitting deliberately false correction reports to degrade detection accuracy
          for other users, or using the Service to build a competing product.
        </Section>

        <Section title="9. Termination">
          We may suspend or terminate access to the Service for violation of these terms or nonpayment.
          You may stop using the Service at any time by cancelling your subscription.
        </Section>

        <Section title="10. Changes to these terms">
          We may update these terms from time to time. Continued use of the Service after a change
          means you accept the updated terms.
        </Section>

        <Section title="11. Governing law">
          These terms are governed by the laws of [state/country &mdash; to be confirmed], without
          regard to conflict-of-law principles.
        </Section>

        <Section title="12. Contact">
          Questions about these terms? Reach us at{" "}
          <a href="/support" style={{ color: "var(--accent)" }}>the support form</a>.
        </Section>
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h2>
      <p style={{ margin: 0, color: "var(--fg-muted)" }}>{children}</p>
    </div>
  );
}
