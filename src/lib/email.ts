// TrialShield — Email helpers (Resend)
// Lazy-init the Resend client so the app boots even when RESEND_API_KEY is missing
// (we just log a warning and skip the send instead of crashing the request).
//
// Required env vars:
//   RESEND_API_KEY        — Resend API token
//   EMAIL_FROM            — verified sender (e.g. "TrialShield <noreply@trialshield.cc>")
//   ADMIN_EMAILS          — comma-separated list (already used by admin auth)
//   NEXT_PUBLIC_SITE_URL  — used to build links inside emails

import { Resend } from 'resend';
import { logError, logInfo, logWarn } from '@/lib/logger';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://trialshield.cc';
const FROM = process.env.EMAIL_FROM || 'TrialShield <noreply@trialshield.cc>';

let client: Resend | null = null;
function getClient(): Resend | null {
    if (!process.env.RESEND_API_KEY) return null;
    if (!client) client = new Resend(process.env.RESEND_API_KEY);
    return client;
}

interface SendArgs {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    tags?: { name: string; value: string }[];
}

async function sendEmail(args: SendArgs): Promise<{ ok: boolean; id?: string; error?: string }> {
    const resend = getClient();
    if (!resend) {
        logWarn('email.skipped', { reason: 'RESEND_API_KEY not set', subject: args.subject });
        return { ok: false, error: 'email_disabled' };
    }
    try {
        const { data, error } = await resend.emails.send({
            from: FROM,
            to: Array.isArray(args.to) ? args.to : [args.to],
            subject: args.subject,
            html: args.html,
            text: args.text,
            replyTo: args.replyTo,
            tags: args.tags,
        });
        if (error) {
            logError('email.send_failed', error, { subject: args.subject });
            return { ok: false, error: error.message };
        }
        logInfo('email.sent', { id: data?.id, subject: args.subject });
        return { ok: true, id: data?.id };
    } catch (err) {
        logError('email.send_exception', err, { subject: args.subject });
        return { ok: false, error: 'send_exception' };
    }
}

// ─── Layout shared by all transactional emails ─────────────────
function layout(args: { title: string; preview: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0b14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb;">
<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;color:transparent;">${escapeHtml(args.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0b14;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#13131f;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 32px 16px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:1px;color:#a78bfa;text-transform:uppercase;">🛡️ TrialShield</div>
      </td></tr>
      <tr><td style="padding:0 32px 32px;">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">${escapeHtml(args.title)}</h1>
        <div style="font-size:15px;line-height:1.6;color:#cbd5e1;">${args.bodyHtml}</div>
        ${args.ctaUrl && args.ctaLabel ? `
        <div style="margin-top:28px;">
          <a href="${escapeAttr(args.ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">${escapeHtml(args.ctaLabel)}</a>
        </div>` : ''}
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#64748b;line-height:1.6;">
        Sent by TrialShield · <a href="${SITE_URL}" style="color:#94a3b8;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a><br>
        If you did not expect this email, you can ignore it.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function escapeAttr(s: string): string {
    return s.replace(/"/g, '%22');
}

function adminEmails(): string[] {
    const raw = process.env.ADMIN_EMAILS || '';
    return raw.split(',').map(e => e.trim()).filter(Boolean);
}

// ─── Specific transactional emails ─────────────────────────────

export async function notifyAdminOfTrialRequest(args: {
    userEmail: string | null;
    userId: string;
    note: string | null;
}): Promise<void> {
    const recipients = adminEmails();
    if (recipients.length === 0) {
        logWarn('email.skipped', { reason: 'ADMIN_EMAILS not set', subject: 'New trial request' });
        return;
    }

    const note = args.note ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #a78bfa;background:rgba(167,139,250,0.06);color:#cbd5e1;font-style:italic;">${escapeHtml(args.note)}</blockquote>` : '<p style="color:#64748b;font-style:italic;">No note provided.</p>';

    await sendEmail({
        to: recipients,
        subject: `New trial request from ${args.userEmail || 'unknown user'}`,
        html: layout({
            title: 'New free trial request',
            preview: `${args.userEmail || 'Someone'} requested a trial`,
            bodyHtml: `
                <p><strong>${escapeHtml(args.userEmail || 'Unknown user')}</strong> just submitted a free trial request.</p>
                ${note}
                <p style="color:#94a3b8;font-size:13px;">User ID: <code style="font-family:monospace;color:#cbd5e1;">${escapeHtml(args.userId)}</code></p>
            `,
            ctaLabel: 'Review in admin panel',
            ctaUrl: `${SITE_URL}/admin/trials`,
        }),
        tags: [{ name: 'event', value: 'trial_requested' }],
    });
}

export async function notifyUserTrialApproved(args: {
    to: string;
    durationDays: number;
    trialEndsAt: string;
}): Promise<void> {
    const formattedDate = new Date(args.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    await sendEmail({
        to: args.to,
        subject: '✅ Your TrialShield free trial is active',
        html: layout({
            title: 'Your free trial is active 🎉',
            preview: `You have ${args.durationDays} days of full access.`,
            bodyHtml: `
                <p>Good news — your free trial has been approved. You now have <strong>${args.durationDays} days</strong> of full access to TrialShield.</p>
                <p>Your trial ends on <strong>${formattedDate}</strong>. Subscribe before that to keep your API key active without interruption.</p>
                <p>Here's what to do next:</p>
                <ol style="margin:8px 0 16px;padding-left:20px;color:#cbd5e1;">
                    <li>Copy your API key from the dashboard.</li>
                    <li>Make your first <code style="color:#a78bfa;">/v1/verify</code> call.</li>
                    <li>Watch results stream into the events page.</li>
                </ol>
            `,
            ctaLabel: 'Open the dashboard',
            ctaUrl: `${SITE_URL}/dashboard`,
        }),
        tags: [{ name: 'event', value: 'trial_approved' }],
    });
}

export async function notifyUserTrialRejected(args: { to: string }): Promise<void> {
    await sendEmail({
        to: args.to,
        subject: 'Your TrialShield trial request',
        html: layout({
            title: 'About your trial request',
            preview: 'Thanks for your interest in TrialShield.',
            bodyHtml: `
                <p>Thanks for your interest in TrialShield. After reviewing your request, we are not able to grant a free trial right now.</p>
                <p>You can still get instant access by subscribing to a paid plan — your account is ready to go as soon as you do.</p>
                <p>If you think this is a mistake or your situation has changed, just reply to this email and we'll take another look.</p>
            `,
            ctaLabel: 'See pricing',
            ctaUrl: `${SITE_URL}/pricing`,
        }),
        tags: [{ name: 'event', value: 'trial_rejected' }],
    });
}
