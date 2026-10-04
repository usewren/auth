// Outgoing email for account confirmation, password reset and invites.
//
// The delivery method is configuration, not code:
//   MAIL_TRANSPORT=log   (default) nothing is sent; each message and its link is written
//                        to the server log, so an admin can pass a link on by hand
//   MAIL_TRANSPORT=smtp  send through any SMTP provider:
//                        SMTP_URL=smtps://user:pass@smtp.example.com:465  (or smtp://…:587)
//   MAIL_FROM="WREN <no-reply@example.com>"  sender for all messages
// If SMTP_URL is set and MAIL_TRANSPORT isn't, smtp is used.

import nodemailer from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html?: string };

function env(key: string): string | undefined {
  const v = process.env[key]?.replace(/\r/g, "").trim();
  return v || undefined;
}

export const mailTransport: "log" | "smtp" =
  (env("MAIL_TRANSPORT") ?? (env("SMTP_URL") ? "smtp" : "log")) === "smtp" ? "smtp" : "log";

/** True when messages actually leave the server. */
export const mailDelivers = mailTransport === "smtp";

const from = env("MAIL_FROM") ?? "WREN <no-reply@localhost>";
let smtp: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Send a message. Never throws: a mail failure must not break sign-up, password
 * reset or invites. Returns true if the message was handed to the mail server.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (mailTransport === "smtp") {
    const url = env("SMTP_URL");
    if (!url) {
      console.error("[mail] MAIL_TRANSPORT=smtp but SMTP_URL is not set; message not sent:", mail.subject, "→", mail.to);
      return false;
    }
    try {
      smtp ??= nodemailer.createTransport(url);
      await smtp.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
      return true;
    } catch (e) {
      console.error(`[mail] sending "${mail.subject}" to ${mail.to} failed:`, (e as Error).message);
      return false;
    }
  }
  console.log(`[mail:log] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n[mail:log] end`);
  return false;
}

// ── Templates ──────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function layout(title: string, intro: string, action: string, url: string, outro: string): Pick<Mail, "text" | "html"> {
  return {
    text: `${intro}\n\n${action}: ${url}\n\n${outro}\n`,
    html: `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111827;max-width:520px;margin:24px auto;padding:0 16px">
<h2 style="color:#4338ca;margin:0 0 16px">${esc(title)}</h2>
<p>${esc(intro)}</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#4338ca;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${esc(action)}</a></p>
<p style="font-size:13px;color:#6b7280">Or open this link: <br><a href="${esc(url)}" style="color:#4338ca;word-break:break-all">${esc(url)}</a></p>
<p style="font-size:13px;color:#6b7280">${esc(outro)}</p>
</body></html>`,
  };
}

export const verificationMail = (to: string, name: string, url: string): Mail => ({
  to, subject: "Confirm your WREN account",
  ...layout("Confirm your email", `Hi ${name || "there"}, please confirm your email address for your new WREN account.`,
    "Confirm email", url, "If you didn't create an account, you can ignore this email."),
});

export const resetPasswordMail = (to: string, name: string, url: string): Mail => ({
  to, subject: "Reset your WREN password",
  ...layout("Reset your password", `Hi ${name || "there"}, someone asked to reset the password for your WREN account.`,
    "Choose a new password", url, "If that wasn't you, ignore this email; your password stays the same. The link expires in 1 hour."),
});

export const inviteMail = (to: string, inviter: string, org: string, role: string, url: string): Mail => ({
  to, subject: `${inviter} invited you to ${org} on WREN`,
  ...layout("You're invited", `${inviter} invited you to join "${org}" on WREN as ${role}.`,
    "Accept the invite", url, "Sign in or create an account with this email address to accept. If you weren't expecting this, ignore it."),
});
