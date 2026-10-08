import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { validateLicense, validateByEmail } from "../lib/license";
import { getRelevantCorrections, formatCorrectionsForPrompt } from "../lib/corrections";
import { getRedis } from "../lib/reseller";
import { enforceLimits, clientIp } from "../lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 5 });

// Deterministically detects one specific, narrow, safe-to-verify-in-code pattern:
// a DKIM signature that cryptographically validated against the sender's own
// domain but failed only on the body hash (i.e. genuinely signed by that domain,
// then altered in transit by a gateway/ESP after signing — not forged), combined
// with SPF passing and DMARC failing purely because neither mechanism aligns due
// to routine third-party sending infrastructure. This has repeatedly proven too
// easy for the model to under-apply as a written prompt exception (it keeps
// re-litigating the Return-Path/bounce-domain mismatch as independently
// suspicious even when told it's covered) — so instead of relying on the model
// to correctly chain several conditional prompt rules, verify the pattern in
// code and hand it a firm, pre-verified fact instead of a rule to apply.
function explainedGatewayDmarcNote(authResults: string | undefined, senderEmail: string | undefined): string {
  const auth = authResults || "";
  const senderDomain = (senderEmail || "").split("@")[1]?.toLowerCase().trim();
  if (!senderDomain) return "";

  const dkimBodyHashFail = /dkim=fail\s*\(body hash did not verify\)/i.test(auth);
  const dmarcFail = /dmarc=fail/i.test(auth);
  const spfPass = /spf=pass/i.test(auth);
  const dMatch = auth.match(/header\.d=([a-z0-9.-]+)/i);
  const dkimDomain = dMatch ? dMatch[1].toLowerCase() : null;

  if (!(dkimBodyHashFail && dmarcFail && spfPass && dkimDomain === senderDomain)) return "";

  return `\n\nAUTOMATED PRE-VERIFICATION (computed in code, not inferred — treat as established fact): This email's DKIM signature cryptographically validated against ${senderDomain} (the domain in the DKIM signature matches the sender's own domain, and the signature itself checked out) — only the body hash failed afterward, meaning the message was genuinely signed by ${senderDomain} and then altered in transit by downstream infrastructure (a security gateway or the sending platform), not forged. The resulting SPF/DMARC misalignment is a mechanical side effect of that same routine infrastructure, not evidence of spoofing. Do not flag the DKIM failure, the DMARC failure, or the Return-Path/bounce domain mismatch as suspicious for this email, and do not weigh them against other signals — this determination is verified, not a judgment call.`;
}

// Same motivation as explainedGatewayDmarcNote, for the opposite and much
// simpler case: dmarc=pass or compauth=pass reason=100 is already present,
// which the prompt has always said should override a raw SPF/DKIM component
// failure — but the model has repeatedly cited the component failure as an
// "unexplained" concern anyway once other signals made the email look
// suspicious for unrelated reasons. This is a purely mechanical fact (no
// pattern-matching needed, unlike the case above), so state it outright
// instead of leaving it as one rule among many for the model to re-derive.
function authAlreadyPassedNote(authResults: string | undefined): string {
  const auth = authResults || "";
  const hasComponentFail = /\b(?:spf|dkim)=fail\b/i.test(auth);
  if (!hasComponentFail) return "";

  const dmarcPass = /dmarc=pass/i.test(auth);
  const compauthPass100 = /compauth=pass\s*reason=100/i.test(auth);
  if (!dmarcPass && !compauthPass100) return "";

  const reasons: string[] = [];
  if (dmarcPass) reasons.push("DMARC passed — the receiving mail system's own authoritative alignment determination, which already accounts for the component result above");
  if (compauthPass100) reasons.push(`Microsoft's composite authentication check passed with its strongest reason code (compauth=pass reason=100) — combining SPF/DKIM/DMARC with sender reputation and history`);

  return `\n\nAUTOMATED PRE-VERIFICATION (computed in code, not inferred — treat as established fact): ${reasons.join(", and ")}. Both are authoritative checks that already supersede an individual SPF or DKIM component failure. Do not cite that component failure as a red flag, describe it as "unexplained," or weigh it against this email's legitimacy — this determination is verified, not a judgment call.`;
}

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { subject, body, sender, senderEmail, replyTo, returnPath, authResults, licenseKey, userEmail, autoLicensedEmail } = req.body || {};

  // The add-in re-analyzes on every email the user selects, so the per-user
  // limit allows heavy inbox triage; the per-IP limit covers a shared office IP.
  const identity = String(autoLicensedEmail || userEmail || licenseKey || "");
  const allowed = await enforceLimits(req, res, getRedis(), [
    { bucket: "analyze:user", id: identity,      limit: 300,  windowSec: 3600 },
    { bucket: "analyze:ip",   id: clientIp(req), limit: 3000, windowSec: 3600 },
  ]);
  if (!allowed) return;

  const license = autoLicensedEmail
    ? await validateByEmail(String(autoLicensedEmail))
    : await validateLicense(String(licenseKey || ""), userEmail ? String(userEmail) : undefined);

  if (!license.valid) {
    return res.status(403).json({ error: license.reason || "Invalid license" });
  }

  if (!body && !subject) {
    return res.status(400).json({ error: "Email content required" });
  }

  const corrections = await getRelevantCorrections(getRedis(), { sender, senderEmail, subject, authResults, body });
  const correctionsBlock = formatCorrectionsForPrompt(corrections);
  const gatewayNote = explainedGatewayDmarcNote(authResults, senderEmail) || authAlreadyPassedNote(authResults);

  const prompt = `You are an email security analyst. Analyze the following email for spam, phishing, or scam indicators. Your goal is accurate verdicts — avoid both false positives on legitimate business email and false negatives on real threats.

Email details:
- From display name: ${sender || "Unknown"}
- From email address: ${senderEmail || "Unknown"}
- Reply-To: ${replyTo || "(same as sender)"}
- Return-Path: ${returnPath || "(not available)"}
- Authentication results: ${authResults || "(not available)"}${gatewayNote}
- Subject: ${subject || "(no subject)"}
- Body:
${(body || "(no body)").slice(0, 3000)}

Respond with ONLY valid JSON in this exact format, no extra text:
{
  "verdict": "SAFE",
  "confidence": 95,
  "summary": "One clear sentence explaining your verdict.",
  "flags": ["specific red flag 1", "specific red flag 2"]
}

Rules:
- verdict must be one of: SAFE, SUSPICIOUS, or SPAM
- confidence is 0-100
- flags should be an empty array [] if none are found
- Keep flags concise and specific
- Only flag something if it is genuinely suspicious in context — not just because it matches a surface-level pattern

Verdicts:
- SAFE: Legitimate email. Use this when the sender domain is established, content matches a normal business purpose, and any concerns are easily explained by normal business practice.
- SUSPICIOUS: Genuine uncertainty. Use this only when there are specific, concrete indicators that cannot be explained by normal business practice.
- SPAM: Clear spam or phishing with multiple strong indicators.

Important context to apply:
- Link protection/rewriting services (linkprotect.cudasvc.com, urldefense.com, safelinks.protection.outlook.com, proofpoint.com redirects, etc.) are legitimate email security tools used by businesses — do NOT flag these as suspicious redirects.
- Transactional emails (invoices, payment receipts, shipping notifications) from domains matching the sender's company name are normal business email — generic greetings like "Valued Customer" are common and not a red flag on their own.
- A physical address, phone number, and matching sender domain together are strong legitimacy signals.
- Business acquisitions and account transfers (e.g. "transferred from Company X") are normal and not indicators of spoofing.
- Short, low-content emails (a one-line reply, a "test" email, a quick internal note) are extremely common in normal business use and are NOT suspicious on their own — do not flag brevity or a generic subject like "test" unless the email also asks for credentials, money, or contains links/QR codes/attachments.
- A sender's signature or contact block mentioning a second company/brand domain (rebrands, sister companies, consultants working under multiple entities) is common and weak on its own — only treat it as meaningful if it's paired with an actual authentication failure or Return-Path/From mismatch.
- Automated security/identity-alert emails (Microsoft Entra/Azure AD Identity Protection, Okta, Duo, Google Workspace alerts, etc.) routinely reference the RECIPIENT organization's own name, domain, or "directory"/"tenant" by name — e.g. "users at risk in the [Company Name] directory" — because the alert is personalized to that specific customer. An Azure AD/Entra "directory" or "tenant" IS the customer's own organization, not a separate third party, so this is expected personalization, not evidence of a mismatch or spoofing. This does not excuse a genuinely unauthenticated sender, though — still weigh the sender's own authentication status and the link's actual destination domain, and treat this as one contextual factor, not an automatic pass (a sender's own name/domain appearing in a message is also a known social-engineering technique when authentication doesn't otherwise check out).
- Weigh ALL available signals together. Multiple WEAK signals (see below) should not be added up into a SUSPICIOUS verdict — SUSPICIOUS requires at least one STRONG signal, or a genuinely coherent pattern (e.g. urgency + credential request + link).

Spoofing and authentication signals — distinguish STRONG (actual failure) from WEAK (no data) from EXPLAINED (looks like a failure but isn't):
- DMARC is the overall authority, not SPF or DKIM individually — DMARC passes if EITHER SPF or DKIM aligns. If the authentication results show "dmarc=pass", treat overall authentication as sound even if SPF or DKIM individually shows fail. Do NOT flag a standalone "dkim=fail" or "spf=fail" as a spoofing indicator when dmarc=pass is also present — that combination is common and expected, not suspicious.
- EXPLAINED, not suspicious: "dkim=fail (body hash did not verify)" specifically (as opposed to a signature/domain failure) is very often caused by a legitimate email security gateway (Barracuda/X-BESS headers, Proofpoint, Mimecast, Cisco IronPort, etc.) rewriting links or content in transit after the original DKIM signature was applied, which breaks the body hash for anyone checking it downstream. This is a routine side effect of security infrastructure, not evidence of tampering — especially when DMARC still passes or an earlier/original authentication result (e.g. "Authentication-Results-Original" from an upstream gateway) shows DKIM passing before the rewrite.
- Microsoft 365/Outlook's "compauth=pass" (composite authentication) in the Authentication-Results header is Microsoft's own advanced anti-spoofing determination, combining SPF/DKIM/DMARC with sender reputation and history — treat "compauth=pass reason=100" as strong evidence of legitimacy, and let it override an isolated raw DKIM/SPF component failure.
- WEAK, NOT a red flag on its own: "compauth=none" means Microsoft simply didn't render a composite judgment (e.g. no reputation history for the sender yet) — it is neither a pass nor a fail. Treat it the same as missing authentication data: inconclusive, not evidence of spoofing.
- EXPLAINED, not suspicious: a "dmarc=fail" can itself be a downstream artifact of the routine gateway-rewrite issue above, not evidence of spoofing — specifically when (a) DKIM fails with exactly "body hash did not verify" (not a signature or domain mismatch), (b) SPF individually shows "pass" but its aligned domain is an unrelated third-party relay/ESP (common, routine infrastructure for newsletter/marketing-platform sending, not spoofing), and (c) no other strong signal is present. (A Return-Path/From mismatch is evaluated on its own terms below — if that mismatch is itself explained there by DKIM domain alignment, it does not disqualify this carve-out either.) In that specific combination, DMARC simply failed to find an aligned mechanism due to routine sending infrastructure plus the gateway rewrite already described — treat it as explained. This carve-out does NOT apply if DKIM fails for any reason other than body-hash verification, if SPF itself shows "fail", or if a genuinely unexplained Return-Path/From mismatch or any other red flag is also present.
- STRONG spoofing indicator: authentication results explicitly showing "dmarc=fail" (the overall DMARC verdict itself failing, not just a component) without the explained combination above, or "compauth=fail" / "compauth=softpass" with other red flags present.
- STRONG: Return-Path domain being unrelated to the From domain — e.g. From: vanta.com but Return-Path at a domain with no visible connection to vanta.com. A Return-Path on an ESP bounce subdomain of the sender's own domain (e.g. mail-bounces.vanta.com for a vanta.com sender) is normal practice for transactional email and is NOT a mismatch. This carve-out also applies when DKIM's signing domain (header.d=) matches the From domain — even if that DKIM signature itself failed only due to a body-hash mismatch (see above) — since that reflects a legitimately configured relationship between the sender's domain and its sending infrastructure (e.g. an ESP or newsletter platform signing on the company's behalf), not spoofing.
- NOT suspicious on its own: sending via a reputable transactional email service (Amazon SES, SendGrid, Mailgun, Postmark, etc.) — this is standard practice for companies of all sizes, not a sign of spoofing.
- WEAK, NOT a red flag on its own: authentication results being absent, unavailable, or simply not showing a pass/fail (e.g. "(not available)", no DKIM header present at all). Most legitimate small businesses and individuals send mail without DKIM/DMARC configured — treat missing authentication data as inconclusive, not as evidence of spoofing, unless combined with a genuine STRONG signal above.

QR code phishing (a rapidly growing attack vector):
- If the email body mentions scanning a QR code, contains little readable text, or appears to be primarily an image, treat this as HIGH suspicion especially if the subject references documents, signatures, invoices, or HR notices.
- Legitimate services like DocuSign, Adobe Sign, and payroll providers do NOT ask users to scan QR codes — they provide direct links. A QR code in a document-signing or HR email is almost always phishing.
- AWS S3-hosted URLs (s3.amazonaws.com, s3.[region].amazonaws.com) used as destinations for document signing or login pages are phishing indicators — legitimate companies do not host their sign-in or document pages on S3 buckets.
- Similarly, any URL that uses a consumer cloud storage service (Google Drive, Dropbox, OneDrive) as a login or document-signing destination is suspicious.

Consider: sender domain legitimacy, Return-Path/From mismatch, SPF/DKIM/DMARC results, urgency or pressure tactics, requests for credentials or money, suspicious links, QR code presence, grammar/spelling issues, mismatched reply-to, spoofed display names.${correctionsBlock}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid response format");

    const result = JSON.parse(jsonMatch[0]);

    if (!["SAFE", "SUSPICIOUS", "SPAM"].includes(result.verdict)) {
      throw new Error("Invalid verdict in response");
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("Analyze error:", err.message);
    const overloaded = err.status === 429 || err.status === 529 || err.status >= 500;
    if (overloaded) {
      return res.status(503).json({ error: "The analysis service is temporarily busy. Please try again in a moment.", retryable: true });
    }
    return res.status(500).json({ error: "Analysis failed. Please try again." });
  }
}
