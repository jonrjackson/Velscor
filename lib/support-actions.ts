"use server";

import { getResend } from "./resend";

export interface SupportFormState {
  error: string | null;
  success?: boolean;
}

export async function submitSupportRequest(
  _prevState: SupportFormState,
  formData: FormData
): Promise<SupportFormState> {
  // Honeypot — real users never fill this hidden field.
  if (String(formData.get("website") || "").trim()) {
    return { error: null, success: true };
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!email || !email.includes("@")) return { error: "Enter a valid email address." };
  if (!message) return { error: "Enter a message." };

  try {
    await getResend().emails.send({
      from: "Velscor Support Form <support@velscor.com>",
      to: "support@velscor.com",
      replyTo: email,
      subject: `Support request from ${name || email}`,
      text: `From: ${name || "(no name)"} <${email}>\n\n${message}`,
    });
  } catch (err) {
    console.error("Support form send error:", err);
    return { error: "Couldn't send your message. Please try again or email support@velscor.com directly." };
  }

  return { error: null, success: true };
}
