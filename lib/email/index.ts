import { Resend } from "resend";
import { passwordResetEmail, workspaceInviteEmail } from "@/lib/email/messages";
import { logger } from "@/lib/observability";

const FROM = process.env.EMAIL_FROM || "Pagistry <onboarding@resend.dev>";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const c = client();
  if (!c) {
    logger.warn("email.skipped_no_key", { to, subject });
    return;
  }
  try {
    await c.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    logger.error("email.send_failed", {
      to,
      subject,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  const { subject, html } = passwordResetEmail(resetUrl);
  await send(to, subject, html);
}

export async function sendWorkspaceInvite(
  to: string,
  inviteUrl: string,
  workspaceName: string,
): Promise<void> {
  const { subject, html } = workspaceInviteEmail(inviteUrl, workspaceName);
  await send(to, subject, html);
}
