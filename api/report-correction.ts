import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateLicense, validateByEmail } from "../lib/license";
import { reportCorrection } from "../lib/corrections";
import { getRedis } from "../lib/reseller";
import { getResend } from "../lib/resend";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    licenseKey, userEmail, autoLicensedEmail,
    senderDisplay, senderEmail, subject, authResults, bodyExcerpt,
    originalVerdict, correctedVerdict, reporterNote,
  } = req.body || {};

  const license = autoLicensedEmail
    ? await validateByEmail(String(autoLicensedEmail))
    : await validateLicense(String(licenseKey || ""), userEmail ? String(userEmail) : undefined);

  if (!license.valid) {
    return res.status(403).json({ error: license.reason || "Invalid license" });
  }

  const db = getRedis();
  let record;
  try {
    record = await reportCorrection(
      {
        senderDisplay, senderEmail, subject, authResults, bodyExcerpt,
        originalVerdict, correctedVerdict, reporterNote,
        reporterEmail: autoLicensedEmail || userEmail || "",
      },
      db
    );
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Couldn't submit report" });
  }

  try {
    await getResend().emails.send({
      from: "Velscor <noreply@velscor.com>",
      to: "support@velscor.com",
      subject: `New correction report: ${senderDisplay || senderEmail || "unknown sender"}`,
      text: `A user reported a verdict as wrong.\n\nSender: ${senderDisplay || "?"} <${senderEmail || "?"}>\nSubject: ${subject || "(none)"}\nOriginal verdict: ${originalVerdict}\nSuggested verdict: ${correctedVerdict}\nReporter note: ${reporterNote || "(none)"}\nReported by: ${record.reporterEmail || "(unknown)"}\n\nReview and approve or reject here:\nhttps://app.velscor.com/admin/corrections/${record.id}`,
    });
  } catch (err) {
    console.error("Failed to email correction report notification:", err);
  }

  return res.status(200).json({ ok: true });
}
