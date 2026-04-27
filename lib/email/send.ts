/**
 * Resend wrapper. No-op when RESEND_API_KEY is missing — use this so
 * development without email credentials doesn't break the doc-issue flow.
 */
import { Resend } from "resend";

let _client: Resend | null = null;

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

export type SendEmailArgs = {
  to: string;
  subject: string;
  /** Plain text body. We auto-wrap in a minimal HTML to render newlines. */
  body: string;
};

export async function sendEmail(
  args: SendEmailArgs,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const c = client();
  if (!c) {
    // eslint-disable-next-line no-console
    console.warn("[email] RESEND_API_KEY not set — skipping send", args);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const from = process.env.EMAIL_FROM ?? "BECOS OEM <onboarding@resend.dev>";

  const html = `<!doctype html><html><body style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;font-size:14px;line-height:1.7;color:#1f1f1f;white-space:pre-wrap;">${escapeHtml(args.body)}</body></html>`;

  try {
    const res = await c.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      text: args.body,
      html,
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
