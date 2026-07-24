import * as React from "react";
import * as ReactDOM from "react-dom/client";

/* global Office */

interface AnalysisResult {
  verdict: "SAFE" | "SUSPICIOUS" | "SPAM";
  confidence: number;
  summary: string;
  flags: string[];
}

interface EmailAttachment {
  id: string;
  name: string;
}

type LicenseStatus = "checking" | "unlicensed" | "licensed";

const VERDICT_STYLES = {
  SAFE:       { color: "#107c10", bg: "#e8f5e9", icon: "✓", label: "Safe" },
  SUSPICIOUS: { color: "#b45309", bg: "#fffbeb", icon: "⚠", label: "Suspicious" },
  SPAM:       { color: "#b91c1c", bg: "#fef2f2", icon: "✗", label: "Spam / Phishing" },
};

const STORAGE_KEY      = "mailguard_license";
const AUTO_STORAGE_KEY = "mailguard_auto";

function daysRemaining(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  let curKey = "";
  let curVal = "";
  for (const line of headerText.split("\n")) {
    if (/^\s+/.test(line) && curKey) {
      curVal += " " + line.trim();
    } else {
      if (curKey) headers[curKey.toLowerCase()] = curVal;
      const ci = line.indexOf(":");
      if (ci > 0) { curKey = line.substring(0, ci).trim(); curVal = line.substring(ci + 1).trim(); }
      else { curKey = ""; curVal = ""; }
    }
  }
  if (curKey) headers[curKey.toLowerCase()] = curVal;
  return headers;
}

function parseEml(rawEml: string) {
  const result = { sender: "", senderEmail: "", subject: "", replyTo: "", returnPath: "", authResults: "", body: "" };

  const emlText = rawEml.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const splitIdx = emlText.indexOf("\n\n");
  if (splitIdx === -1) return result;

  const headerSection = emlText.substring(0, splitIdx);
  const bodySection   = emlText.substring(splitIdx + 2);

  const headers = parseHeaders(headerSection);

  const from = headers["from"] || "";
  const fromMatch = from.match(/^(.*?)\s*<(.+?)>$/);
  if (fromMatch) {
    result.sender      = fromMatch[1].trim().replace(/^"|"$/g, "");
    result.senderEmail = fromMatch[2].trim();
  } else {
    result.senderEmail = from.trim();
  }

  result.subject = (headers["subject"] || "").replace(/=\?[^?]+\?[BQ]\?[^?]+\?=/gi, "").trim();

  const rt = headers["reply-to"] || "";
  const rtMatch = rt.match(/<(.+?)>/);
  result.replyTo = rtMatch ? rtMatch[1] : rt.trim();

  const rp = headers["return-path"] || "";
  const rpMatch = rp.match(/<(.+?)>/);
  result.returnPath = rpMatch ? rpMatch[1] : rp.trim();
  result.authResults = headers["authentication-results"] || headers["arc-authentication-results"] || "";

  const ct = headers["content-type"] || "";
  if (ct.toLowerCase().includes("multipart")) {
    const bm = ct.match(/boundary="?([^";\s\r]+)"?/);
    if (bm) {
      const parts = bodySection.split("--" + bm[1]);
      for (const part of parts) {
        if (/content-type:\s*text\/plain/i.test(part)) {
          const ps = part.indexOf("\n\n");
          if (ps !== -1) { result.body = part.substring(ps + 2).trim(); break; }
        }
      }
    }
    if (!result.body) result.body = bodySection.substring(0, 3000);
  } else {
    const enc = (headers["content-transfer-encoding"] || "").toLowerCase();
    if (enc === "base64") {
      try { result.body = atob(bodySection.replace(/\s/g, "")); } catch { result.body = bodySection; }
    } else if (enc === "quoted-printable") {
      result.body = bodySection
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    } else {
      result.body = bodySection;
    }
  }

  result.body = result.body.substring(0, 3000);
  return result;
}

function App() {
  // Current user's Outlook email (used for license scope enforcement)
  const userEmail = React.useMemo(() => {
    try { return (Office as any).context.mailbox.userProfile.emailAddress || ""; }
    catch { return ""; }
  }, []);

  // License state
  const [licenseStatus, setLicenseStatus]   = React.useState<LicenseStatus>("checking");
  const [licenseKey, setLicenseKey]         = React.useState<string | null>(null);
  const [autoProvisioned, setAutoProvisioned] = React.useState(false);
  const [licenseType, setLicenseType]       = React.useState<string | null>(null);
  const [licenseExpiry, setLicenseExpiry]   = React.useState<string | null>(null);
  const [licenseInput, setLicenseInput]     = React.useState("");
  const [licenseError, setLicenseError]     = React.useState<string | null>(null);
  const [activating, setActivating]         = React.useState(false);

  // Email analysis state
  const [loading, setLoading]             = React.useState(false);
  const [result, setResult]               = React.useState<AnalysisResult | null>(null);
  const [error, setError]                 = React.useState<string | null>(null);
  const [analyzedLabel, setAnalyzedLabel] = React.useState("This email");
  const [attachments, setAttachments]     = React.useState<EmailAttachment[]>([]);

  const hasAnalyzed    = React.useRef(false);
  const analyzeEmailRef = React.useRef<() => Promise<void>>(async () => {});

  // Keep ref pointing at the latest analyzeEmail so ItemChanged handler stays current
  React.useEffect(() => { analyzeEmailRef.current = analyzeEmail; });

  // On mount: check saved key, then try auto-provision, then show entry screen
  React.useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY);
    if (savedKey) { checkLicense(savedKey, false); return; }

    // Try auto-provision using the user's Outlook email
    if (userEmail) {
      tryAutoProvision();
    } else {
      setLicenseStatus("unlicensed");
    }
  }, []);

  // Auto-analyze once licensed; register ItemChanged handler for email navigation
  React.useEffect(() => {
    if (licenseStatus !== "licensed") return;

    if (!hasAnalyzed.current) {
      hasAnalyzed.current = true;
      analyzeEmail();
    }

    // Re-analyze automatically when the user selects a different email
    const mailbox = (Office as any).context.mailbox;
    if (mailbox.addHandlerAsync) {
      mailbox.addHandlerAsync(
        (Office as any).EventType.ItemChanged,
        () => {
          setResult(null);
          setError(null);
          setAttachments([]);
          analyzeEmailRef.current();
        }
      );
    }
  }, [licenseStatus]);

  const tryAutoProvision = async () => {
    try {
      const res  = await fetch("/api/auto-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem(AUTO_STORAGE_KEY, JSON.stringify({ email: userEmail, checkedAt: Date.now() }));
        setAutoProvisioned(true);
        setLicenseType(data.type || "org");
        setLicenseExpiry(data.expiresAt || null);
        setLicenseStatus("licensed");
      } else {
        setLicenseStatus("unlicensed");
      }
    } catch {
      setLicenseStatus("unlicensed");
    }
  };

  const checkLicense = async (key: string, save: boolean) => {
    try {
      const res  = await fetch("/api/validate-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (data.valid) {
        if (save) localStorage.setItem(STORAGE_KEY, key);
        setLicenseKey(key);
        setLicenseType(data.type || null);
        setLicenseExpiry(data.expiresAt || null);
        setLicenseStatus("licensed");
      } else {
        if (!save) localStorage.removeItem(STORAGE_KEY);
        setLicenseStatus("unlicensed");
        if (save) setLicenseError(data.reason || "Invalid license key");
      }
    } catch {
      if (!save) setLicenseStatus("unlicensed");
      if (save) setLicenseError("Could not reach license server");
    }
  };

  const activateLicense = async () => {
    const key = licenseInput.trim().toUpperCase();
    if (!key) return;
    setActivating(true);
    setLicenseError(null);
    await checkLicense(key, true);
    setActivating(false);
  };

  const callApi = async (data: object): Promise<AnalysisResult> => {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        ...(autoProvisioned
          ? { autoLicensedEmail: userEmail }
          : { licenseKey, userEmail }),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 403) throw new Error(err.error || "License invalid or expired");
      throw new Error("Analysis service unavailable");
    }
    return response.json();
  };

  const analyzeEmail = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalyzedLabel("This email");

    try {
      const item = (Office as any).context.mailbox.item;

      const sender      = item.from?.displayName  || "";
      const senderEmail = item.from?.emailAddress || "";
      const subject     = item.subject            || "";
      const replyTo     = item.replyTo?.length > 0 ? item.replyTo[0].emailAddress : "";

      setAttachments(
        (item.attachments || [])
          .filter((a: any) => {
            if (a.isInline) return false;
            const t = String(a.attachmentType ?? "").toLowerCase();
            return t === "item" || t === "1" ||
              a.contentType === "message/rfc822" ||
              /\.(eml|msg)$/i.test(a.name || "");
          })
          .map((a: any) => ({ id: a.id, name: a.name || "Attached email" }))
      );

      const [body, allHeaders] = await Promise.all([
        new Promise<string>((resolve, reject) => {
          item.body.getAsync(
            (Office as any).CoercionType.Text,
            (r: any) => r.status === (Office as any).AsyncResultStatus.Succeeded
              ? resolve(r.value)
              : reject(new Error("Could not read email body"))
          );
        }),
        new Promise<string>((resolve) => {
          if (item.getAllInternetHeadersAsync) {
            item.getAllInternetHeadersAsync((r: any) =>
              resolve(r.status === (Office as any).AsyncResultStatus.Succeeded ? r.value : "")
            );
          } else {
            resolve("");
          }
        }),
      ]);

      const parsedHeaders = parseHeaders(allHeaders.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
      const rp = parsedHeaders["return-path"] || "";
      const rpMatch = rp.match(/<(.+?)>/);
      const returnPath = rpMatch ? rpMatch[1] : rp.trim();
      const authResults = parsedHeaders["authentication-results"] || parsedHeaders["arc-authentication-results"] || "";

      setResult(await callApi({ subject, body, sender, senderEmail, replyTo, returnPath, authResults }));
    } catch (err: any) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeAttachment = async (att: EmailAttachment) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalyzedLabel(`Attached: "${att.name}"`);

    try {
      const item = (Office as any).context.mailbox.item;

      const { content, format } = await new Promise<{ content: string; format: string }>((resolve, reject) => {
        item.getAttachmentContentAsync(att.id, (r: any) =>
          r.status === (Office as any).AsyncResultStatus.Succeeded
            ? resolve({ content: r.value.content, format: r.value.format })
            : reject(new Error("Could not read attached email"))
        );
      });

      const emlText = (format === "base64" || format === "Base64")
        ? atob(content.replace(/\s/g, ""))
        : content;

      const parsed = parseEml(emlText);
      if (!parsed.senderEmail && !parsed.subject && !parsed.body) {
        throw new Error("Could not parse attached email content");
      }

      setResult(await callApi(parsed));
    } catch (err: any) {
      setError(err.message || "Could not analyze attached email.");
    } finally {
      setLoading(false);
    }
  };

  const vstyle = result ? VERDICT_STYLES[result.verdict] : null;

  // ── License badge ──────────────────────────────────────────────────────────
  const licenseBadge = (() => {
    if (licenseType === "permanent") return { text: "Licensed ✓", color: "#107c10" };
    if (licenseType === "trial" && licenseExpiry) {
      const days = daysRemaining(licenseExpiry);
      return { text: `Trial — ${days}d left`, color: days <= 7 ? "#b45309" : "#0369a1" };
    }
    return null;
  })();

  // ── Checking license ───────────────────────────────────────────────────────
  if (licenseStatus === "checking") {
    return (
      <div style={{ padding: "16px", maxWidth: "380px", margin: "0 auto", textAlign: "center", paddingTop: "60px", color: "#6b7280" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#0078d4", marginBottom: "8px" }}>MailGuard</div>
        <div style={{ fontSize: "13px" }}>Checking license…</div>
      </div>
    );
  }

  // ── License entry screen ───────────────────────────────────────────────────
  if (licenseStatus === "unlicensed") {
    return (
      <div style={{ padding: "24px", maxWidth: "380px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#0078d4" }}>MailGuard</div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>AI Spam Detector</div>
        </div>

        <div style={{ fontSize: "13px", color: "#374151", marginBottom: "16px", textAlign: "center" }}>
          Enter your license key to get started.
        </div>

        <input
          type="text"
          placeholder="MG-XXXX-XXXX-XXXX-XXXX"
          value={licenseInput}
          onChange={(e) => setLicenseInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && activateLicense()}
          style={{
            width: "100%", boxSizing: "border-box", padding: "10px 12px",
            border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px",
            fontFamily: "monospace", marginBottom: "10px", outline: "none",
          }}
        />

        {licenseError && (
          <div style={{ fontSize: "12px", color: "#b91c1c", marginBottom: "10px", padding: "8px 10px", background: "#fef2f2", borderRadius: "6px" }}>
            {licenseError}
          </div>
        )}

        <button
          onClick={activateLicense}
          disabled={activating}
          style={{
            width: "100%", padding: "10px", background: activating ? "#93c5fd" : "#0078d4",
            color: "#fff", border: "none", borderRadius: "6px", fontSize: "14px",
            fontFamily: "Segoe UI, sans-serif", cursor: activating ? "default" : "pointer", fontWeight: 500,
          }}
        >
          {activating ? "Checking…" : "Activate License"}
        </button>
      </div>
    );
  }

  // ── Main analysis UI ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: "16px", maxWidth: "380px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
        <span style={{ fontSize: "18px", fontWeight: 700, color: "#0078d4" }}>MailGuard</span>
        <span style={{ marginLeft: "8px", fontSize: "11px", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: "999px" }}>AI Spam Detector</span>
        {licenseBadge && (
          <span style={{ marginLeft: "auto", fontSize: "10px", color: licenseBadge.color, fontWeight: 600 }}>
            {licenseBadge.text}
          </span>
        )}
      </div>

      {/* Expiry warning */}
      {licenseExpiry && licenseType !== "permanent" && daysRemaining(licenseExpiry) <= 7 && (
        <div style={{ padding: "10px 12px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px", marginBottom: "14px", fontSize: "12px", color: "#92400e" }}>
          ⚠ Your license expires in {daysRemaining(licenseExpiry)} day{daysRemaining(licenseExpiry) !== 1 ? "s" : ""}. Contact your admin to renew.
        </div>
      )}

      {/* What was analyzed */}
      {!loading && (result || error) && (
        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "10px" }}>
          Analyzed: {analyzedLabel}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
          <div style={{ fontSize: "28px", marginBottom: "10px" }}>🔍</div>
          <div style={{ fontSize: "14px" }}>Analyzing {analyzedLabel.toLowerCase()}…</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#b91c1c", fontSize: "13px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && !loading && vstyle && (
        <div>
          <div style={{ background: vstyle.bg, border: `1px solid ${vstyle.color}30`, borderRadius: "10px", padding: "20px", textAlign: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "36px", marginBottom: "4px" }}>{vstyle.icon}</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: vstyle.color }}>{vstyle.label}</div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{result.confidence}% confidence</div>
          </div>

          <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151", marginBottom: "16px", padding: "12px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            {result.summary}
          </div>

          {result.flags?.length > 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
              <div style={{ fontWeight: 600, fontSize: "12px", color: "#374151", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Red Flags</div>
              <ul style={{ paddingLeft: "18px", margin: 0 }}>
                {result.flags.map((flag, i) => (
                  <li key={i} style={{ fontSize: "13px", color: "#4b5563", marginBottom: "4px", lineHeight: "1.5" }}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "#6b7280", textAlign: "center", marginBottom: "16px" }}>
              No specific red flags detected.
            </div>
          )}
        </div>
      )}

      {/* Re-analyze button */}
      {!loading && (
        <button
          onClick={analyzeEmail}
          style={{ width: "100%", padding: "10px", background: "#0078d4", color: "#fff", border: "none", borderRadius: "6px", fontSize: "14px", fontFamily: "Segoe UI, sans-serif", cursor: "pointer", fontWeight: 500 }}
        >
          {result || error ? "Re-analyze this email" : "Analyze Email"}
        </button>
      )}

      {/* Attached emails section */}
      {attachments.length > 0 && !loading && (
        <div style={{ marginTop: "16px", padding: "12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px" }}>
          <div style={{ fontWeight: 600, fontSize: "12px", color: "#0369a1", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Attached Email{attachments.length > 1 ? "s" : ""}
          </div>
          {attachments.map((att) => (
            <div key={att.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "8px" }}>
                {att.name}
              </span>
              <button
                onClick={() => analyzeAttachment(att)}
                style={{ flexShrink: 0, padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontFamily: "Segoe UI, sans-serif" }}
              >
                Analyze
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

Office.onReady(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
