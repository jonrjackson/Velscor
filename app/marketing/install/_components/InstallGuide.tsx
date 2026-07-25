"use client";

import { useState } from "react";

const MANIFEST_URL = "https://velscor.com/manifest.xml";

export default function InstallGuide({ initialTab }: { initialTab: "individual" | "org" }) {
  const [tab, setTab] = useState<"individual" | "org">(initialTab);
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(MANIFEST_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the URL is still selectable/visible on the page
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 32, borderBottom: "1px solid var(--border)" }}>
        <TabButton active={tab === "individual"} onClick={() => setTab("individual")}>
          I&rsquo;m installing it myself
        </TabButton>
        <TabButton active={tab === "org"} onClick={() => setTab("org")}>
          I&rsquo;m an IT admin
        </TabButton>
      </div>

      {tab === "individual" ? (
        <div>
          <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
            Takes about 2 minutes. Works the same way in Outlook on the web and the Outlook app on
            Windows or Mac.
          </p>

          <ol style={{ display: "flex", flexDirection: "column", gap: 20, listStyle: "none", padding: 0, margin: "0 0 32px" }}>
            <Step n={1} title="Open Outlook">
              Go to <a href="https://outlook.office.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>outlook.office.com</a>,
              or open the Outlook app on your computer.
            </Step>
            <Step n={2} title="Find &ldquo;Get Add-ins&rdquo;">
              Look for a small puzzle-piece icon in the toolbar at the top of your inbox (sometimes labeled
              &ldquo;Get Add-ins&rdquo; or &ldquo;Apps&rdquo;). Click it.
            </Step>
            <Step n={3} title="Add a custom add-in">
              In the window that opens, click <strong>My add-ins</strong> on the left. Scroll down to
              &ldquo;Custom Addins&rdquo; and click <strong>+ Add a custom add-in → Add from URL</strong>.
            </Step>
            <Step n={4} title="Paste this link">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  padding: "10px 14px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 14,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: 1, wordBreak: "break-all" }}>{MANIFEST_URL}</span>
                <button
                  onClick={copyUrl}
                  className="btn btn-secondary"
                  style={{ padding: "4px 12px", fontSize: 13, whiteSpace: "nowrap" }}
                  type="button"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>
                Click Install, then confirm on the warning popup &mdash; that&rsquo;s normal for custom add-ins.
              </p>
            </Step>
            <Step n={5} title="Open any email">
              You&rsquo;ll see a <strong>Velscor</strong> button in the ribbon or reading pane. Click it.
            </Step>
            <Step n={6} title="Enter your license key">
              The first time, you&rsquo;ll be asked for your license key &mdash; it&rsquo;s on the page you
              landed on right after checkout, and also in your{" "}
              <a href="https://app.velscor.com/sign-up" style={{ color: "var(--accent)" }}>account portal</a>{" "}
              (create an account with the same email you checked out with). After that, Velscor just works.
            </Step>
          </ol>

          <div className="card" style={{ padding: 20 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-muted)" }}>
              Don&rsquo;t see the puzzle-piece icon? In the Outlook app, check the <strong>Home</strong> tab
              of the ribbon for a <strong>Get Add-ins</strong> button instead &mdash; same steps from there.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
            Deploy Velscor for your whole team at once through the Microsoft 365 admin center. Once
            it&rsquo;s deployed, nobody on your team needs to do anything &mdash; Velscor just appears in
            their Outlook automatically, and activates itself when they sign in with their work email.
          </p>

          <ol style={{ display: "flex", flexDirection: "column", gap: 20, listStyle: "none", padding: 0, margin: "0 0 32px" }}>
            <Step n={1} title="Go to the Microsoft 365 admin center">
              Sign in at{" "}
              <a href="https://admin.microsoft.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                admin.microsoft.com
              </a>{" "}
              with your admin account.
            </Step>
            <Step n={2} title="Open Integrated apps">
              In the left menu, go to <strong>Settings → Integrated apps</strong>.
            </Step>
            <Step n={3} title="Upload the add-in">
              Click <strong>Upload custom apps</strong>, choose <strong>Provide link to manifest file</strong>,
              and paste:
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  padding: "10px 14px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 14,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: 1, wordBreak: "break-all" }}>{MANIFEST_URL}</span>
                <button
                  onClick={copyUrl}
                  className="btn btn-secondary"
                  style={{ padding: "4px 12px", fontSize: 13, whiteSpace: "nowrap" }}
                  type="button"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </Step>
            <Step n={4} title="Assign it to everyone">
              Choose <strong>Everyone</strong> (or a specific group, if you&rsquo;d rather roll it out
              gradually), then click <strong>Deploy</strong>.
            </Step>
            <Step n={5} title="Give it a little time">
              Microsoft can take a few hours (rarely up to a day) to push the add-in out to everyone&rsquo;s
              Outlook. No further action needed on your end.
            </Step>
          </ol>

          <div className="card" style={{ padding: 20 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--fg-muted)" }}>
              Seats activate automatically as people on your domain start using Velscor &mdash; there are no
              individual license keys to hand out for team plans.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px 4px",
        marginRight: 24,
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        fontSize: 15,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 16 }}>
      <div
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {n}
      </div>
      <div>
        <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{title}</p>
        <div style={{ color: "var(--fg-muted)", fontSize: 15, lineHeight: 1.6 }}>{children}</div>
      </div>
    </li>
  );
}
