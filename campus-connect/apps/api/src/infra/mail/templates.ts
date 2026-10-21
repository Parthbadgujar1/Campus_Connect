// Email templates. Every message has an HTML and a plain-text part, and a footer with the
// operator's details. Non-essential categories carry an unsubscribe link (and the
// List-Unsubscribe header, added by the mailer); transactional and security mail links to the
// email preferences page instead, because people cannot opt out of e.g. password resets.

export type TemplateName =
  | 'verify_email'
  | 'account_exists'
  | 'reset_password'
  | 'password_changed'
  | 'new_sign_in'
  | 'welcome'
  | 'account_deletion_scheduled'
  | 'account_deleted'
  | 'data_export_ready'
  | 'data_request_confirm'
  | 'verification_decision'
  | 'notification_digest'
  | 'contact_received';

export interface RenderContext {
  appName: string;
  webUrl: string;
  supportEmail: string;
  operatorLine: string;
  unsubscribeUrl?: string;
  preferencesUrl: string;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(ctx: RenderContext, title: string, bodyHtml: string, action?: { label: string; url: string }): string {
  const button = action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(action.label)}</a></p>
       <p style="font-size:13px;color:#475569">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : '';
  const unsubscribe = ctx.unsubscribeUrl
    ? `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:#475569">Unsubscribe</a> · `
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="font-weight:700;color:#2563eb;margin:0 0 16px">${escapeHtml(ctx.appName)}</p>
<h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
${button}
</td></tr></table>
<p style="font-size:12px;color:#475569;max-width:560px;margin:20px auto 0;line-height:1.6">
${escapeHtml(ctx.operatorLine)}<br>
${unsubscribe}<a href="${escapeHtml(ctx.preferencesUrl)}" style="color:#475569">Email preferences</a> · <a href="${escapeHtml(ctx.webUrl)}/privacy" style="color:#475569">Privacy policy</a> · Questions? <a href="mailto:${escapeHtml(ctx.supportEmail)}" style="color:#475569">${escapeHtml(ctx.supportEmail)}</a>
</p>
</td></tr></table></body></html>`;
}

function textLayout(ctx: RenderContext, title: string, lines: string[], action?: { label: string; url: string }): string {
  const parts = [title, '', ...lines];
  if (action) parts.push('', `${action.label}: ${action.url}`);
  parts.push('', '--', ctx.operatorLine);
  if (ctx.unsubscribeUrl) parts.push(`Unsubscribe: ${ctx.unsubscribeUrl}`);
  parts.push(`Email preferences: ${ctx.preferencesUrl}`);
  return parts.join('\n');
}

type Payload = Record<string, unknown>;

function render(ctx: RenderContext, subject: string, title: string, paragraphs: string[], action?: { label: string; url: string }): Rendered {
  const html = layout(
    ctx,
    title,
    paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(p)}</p>`).join(''),
    action,
  );
  return { subject, html, text: textLayout(ctx, title, paragraphs, action) };
}

export function renderTemplate(name: TemplateName, payload: Payload, ctx: RenderContext): Rendered {
  const name_ = String(payload.name ?? 'there');
  switch (name) {
    case 'verify_email':
      return render(ctx, `Verify your ${ctx.appName} email`, `Hi ${name_}, confirm your email`, [
        'Tap the button to verify your college email and finish creating your account.',
        'The link works once and expires in 24 hours. If you did not sign up, you can ignore this email.',
      ], { label: 'Verify email', url: String(payload.url) });
    case 'account_exists':
      return render(ctx, `Someone tried to sign up with your email`, 'You already have an account', [
        `Someone (probably you) tried to create a ${ctx.appName} account with this email address, which already has one.`,
        'You can sign in, or reset your password if you have forgotten it. If this was not you, no action is needed.',
      ], { label: 'Reset password', url: `${ctx.webUrl}/forgot-password` });
    case 'reset_password':
      return render(ctx, `Reset your ${ctx.appName} password`, 'Reset your password', [
        'We received a request to reset your password. The link works once and expires in 60 minutes.',
        'If you did not ask for this, ignore this email: your password stays the same.',
      ], { label: 'Choose a new password', url: String(payload.url) });
    case 'password_changed':
      return render(ctx, `Your ${ctx.appName} password was changed`, 'Your password was changed', [
        `The password for your account was changed on ${String(payload.when ?? 'just now')}. All other devices have been signed out.`,
        `If this was not you, reset your password now and contact ${ctx.supportEmail}.`,
      ], { label: 'Reset password', url: `${ctx.webUrl}/forgot-password` });
    case 'new_sign_in':
      return render(ctx, `New sign-in to ${ctx.appName}`, 'New sign-in to your account', [
        `Your account was used to sign in on ${String(payload.device ?? 'a new device')} at ${String(payload.when ?? 'just now')}.`,
        'If this was you, there is nothing to do. If not, sign out other sessions and change your password.',
      ], { label: 'Review active sessions', url: `${ctx.webUrl}/settings/privacy#sessions` });
    case 'welcome':
      return render(ctx, `Welcome to ${ctx.appName}`, `Welcome, ${name_}`, [
        'Your email is verified and your account is ready. Join your class spaces, check upcoming events and say hello to your classmates.',
      ], { label: 'Open CampusConnect', url: ctx.webUrl });
    case 'account_deletion_scheduled':
      return render(ctx, `Your ${ctx.appName} account will be deleted`, 'Account deletion scheduled', [
        `Your account and personal data will be permanently deleted on ${String(payload.when)}.`,
        'Changed your mind? Sign in before then and cancel the deletion from Settings.',
      ], { label: 'Sign in to cancel', url: `${ctx.webUrl}/login` });
    case 'account_deleted':
      return render(ctx, `Your ${ctx.appName} account was deleted`, 'Your account has been deleted', [
        'Your account and personal data have been deleted. Posts you wrote now show as "Deleted user".',
        'Thank you for being part of the community.',
      ]);
    case 'data_export_ready':
      return render(ctx, `Your ${ctx.appName} data export is ready`, 'Your data export is ready', [
        'Your copy of the data we hold about you is ready to download. The link expires in 7 days.',
      ], { label: 'Download my data', url: String(payload.url) });
    case 'data_request_confirm':
      return render(ctx, `Confirm your ${ctx.appName} data request`, 'Confirm your request', [
        `We received a request to ${payload.kind === 'deletion' ? 'delete the account and data' : 'export the data'} linked to this email.`,
        'Confirm it with the button below. The link expires in 24 hours. If you did not ask for this, ignore this email.',
      ], { label: 'Confirm request', url: String(payload.url) });
    case 'verification_decision':
      return render(ctx, `Your ${ctx.appName} verification`, payload.approved ? 'You are verified' : 'Verification needs another try', [
        payload.approved
          ? 'Your verification was approved. Your profile now shows the verified badge.'
          : `Your verification could not be approved${payload.note ? `: ${String(payload.note)}` : '.'} You can submit a new request from Settings.`,
      ], { label: 'Open settings', url: `${ctx.webUrl}/settings` });
    case 'notification_digest': {
      const items = Array.isArray(payload.items) ? (payload.items as Array<{ title: string }>).slice(0, 10) : [];
      return render(ctx, `Your ${ctx.appName} summary`, 'Here is what you missed', items.length ? items.map((i) => `• ${i.title}`) : ['Nothing new since your last summary.'], {
        label: 'Open notifications',
        url: `${ctx.webUrl}/notifications`,
      });
    }
    case 'contact_received':
      return render(ctx, `We received your message`, `Thanks, ${name_}`, [
        `We received your message "${String(payload.subject ?? '')}" and will reply to this address, usually within two working days.`,
      ]);
  }
}
