import 'server-only';

import nodemailer from 'nodemailer';

import { siteURL } from '@/lib/site-url';

/**
 * The site's light theme (see globals.css), as hex: most email clients don't
 * know oklch.
 */
const colors = {
  // The header, as dark as the stream's own be-right-back screen
  header: '#15151c',
  primary: '#6d28d9',
  primaryStrong: '#5b21b6',
  tint: '#f1ecfb',
  foreground: '#15151c',
  muted: '#4b4b58',
  border: '#e2e0ea',
};

/**
 * Tables and inline styles, since that's all every email client agrees on.
 * Just a dark header on a plain page: the mail app is already a frame of
 * its own.
 */
function layout(heading: string, body: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td align="center" style="background:${colors.header};border-radius:16px;padding:20px 24px;font-family:sans-serif;font-size:26px;font-weight:bold;letter-spacing:1px;color:#ffffff;">Stream</td>
            </tr>
            <tr>
              <td style="padding:28px 4px 8px;font-family:sans-serif;font-size:15px;line-height:1.6;color:${colors.foreground};text-wrap:pretty;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${colors.primaryStrong};">${heading}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 4px 0;border-top:1px solid ${colors.border};font-family:sans-serif;font-size:12px;color:${colors.muted};">
                Sent by <a href="${siteURL.origin}" style="color:${colors.muted};">${siteURL.host}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmail(email: { to: string; subject: string; heading: string; body: string; text: string }) {
  // The mail server, e.g. smtps://no-reply%40example.com:password@mail.example.com
  const url = process.env.SMTP_URL;
  if (!url) throw new Error('Set SMTP_URL to send emails.');

  await nodemailer.createTransport(url).sendMail({
    from: process.env.EMAIL_FROM ?? `Stream <no-reply@${siteURL.hostname}>`,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: layout(email.heading, email.body),
    // A unique value stops Gmail from grouping emails with the same subject
    // into one conversation, where it hides the repeated text behind "…".
    headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
  });
}

/** In a table cell, so Outlook still paints the whole button and not only behind the label. */
function button(url: string, label: string, color = colors.primary) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background:${color};border-radius:10px;">
          <a href="${url}" style="display:inline-block;padding:12px 24px;font-family:sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
        </td>
      </tr>
    </table>
  `;
}

export async function sendPasswordResetEmail({ email, name, url }: { email: string; name: string; url: string }) {
  await sendEmail({
    to: email,
    subject: 'Reset your Stream password',
    heading: 'Reset your password',
    body: `
      <p>Hi ${escapeHtml(name)}, we received a request to reset your Stream password. Click the link below to choose a new one. This link expires in 1 hour.</p>
      ${button(url, 'Reset Password')}
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
    text: `Hi ${name},\n\nWe received a request to reset your Stream password. Open this link to choose a new one:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  });
}

export async function sendVerificationEmail({
  email,
  name,
  url,
  changing,
}: {
  email: string;
  name: string;
  url: string;
  /** True for the last step of changing an email address. */
  changing: boolean;
}) {
  const ignore = changing
    ? "If you didn't ask to change your email, you can safely ignore this email."
    : "If you didn't set up Stream, you can safely ignore this email.";

  await sendEmail({
    to: email,
    subject: changing ? 'Confirm your new email for Stream' : 'Verify your email for Stream',
    heading: changing ? 'Confirm your new email' : 'Verify your email',
    body: `
      <p>Hi ${escapeHtml(name)}, please confirm this is your email address by clicking the link below. This link expires in 24 hours.</p>
      ${button(url, 'Verify Email')}
      <p>${ignore}</p>
    `,
    text: `Hi ${name},\n\nPlease confirm this is your email address by opening this link:\n\n${url}\n\nThis link expires in 24 hours. ${ignore}`,
  });
}

/** First step of changing a verified email: sent to the current address. */
export async function sendEmailChangeConfirmation({ email, name, newEmail, url }: { email: string; name: string; newEmail: string; url: string }) {
  await sendEmail({
    to: email,
    subject: 'Confirm your email change for Stream',
    heading: 'Confirm your email change',
    body: `
      <p>Hi ${escapeHtml(name)}, someone (hopefully you) asked to change the email address of your Stream account to <strong>${escapeHtml(newEmail)}</strong>. Click the link below to confirm, and we'll send one last link to the new address. This link expires in 24 hours.</p>
      ${button(url, 'Confirm Change')}
      <p>If you didn't ask for this, ignore this email and consider changing your password.</p>
    `,
    text: `Hi ${name},\n\nSomeone (hopefully you) asked to change the email address of your Stream account to ${newEmail}. Open this link to confirm, and we'll send one last link to the new address:\n\n${url}\n\nThis link expires in 24 hours. If you didn't ask for this, ignore this email and consider changing your password.`,
  });
}

/** The code for the second step of signing in, for accounts using email codes. */
export async function sendTwoFactorCode({ email, name, code }: { email: string; name: string; code: string }) {
  await sendEmail({
    to: email,
    subject: `${code} is your Stream sign-in code`,
    heading: 'Your sign-in code',
    body: `
      <p>Hi ${escapeHtml(name)}, here's your code:</p>
      <p style="margin:20px 0;padding:14px 0 14px 8px;background:${colors.tint};border-radius:10px;text-align:center;font-family:sans-serif;font-size:30px;font-weight:bold;letter-spacing:8px;font-variant-numeric:tabular-nums;color:${colors.primaryStrong};">${code}</p>
      <p>It expires in 5 minutes. If you didn't just sign in, someone may know your password: change it in Stream's settings.</p>
    `,
    text: `Hi ${name},\n\nYour code to finish signing in is:\n\n${code}\n\nIt expires in 5 minutes. If you didn't just sign in, someone may know your password: change it in Stream's settings.`,
  });
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
