import nodemailer from "nodemailer";

export interface SendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  recipient?: string;
  error?: string;
}

/**
 * Sends the report by email via SMTP. When `SMTP_HOST` is not configured the
 * send is skipped (not an error) — a deployment without mail set up simply
 * records a `SKIPPED` history row.
 */
export async function sendEmail(subject: string, text: string): Promise<SendResult> {
  const host = process.env.SMTP_HOST;
  const to = process.env.REPORT_EMAIL_TO;
  if (!host || !to) return { status: "SKIPPED" };
  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM ?? host, to, subject, text });
    return { status: "SENT", recipient: to };
  } catch (err) {
    return { status: "FAILED", recipient: to, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Pushes the report to LINE via the Messaging API. Skipped when the channel
 * token / recipient are not configured.
 */
export async function sendLine(text: string): Promise<SendResult> {
  const token = process.env.LINE_CHANNEL_TOKEN;
  const to = process.env.LINE_TO;
  if (!token || !to) return { status: "SKIPPED" };
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
    if (!res.ok) {
      return { status: "FAILED", recipient: to, error: `LINE API ${res.status}` };
    }
    return { status: "SENT", recipient: to };
  } catch (err) {
    return { status: "FAILED", recipient: to, error: err instanceof Error ? err.message : String(err) };
  }
}
