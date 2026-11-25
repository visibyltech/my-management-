import type { IncomingMessage, ServerResponse } from 'http';
import firebaseConfig from '../firebase-applet-config.json';

const ADMIN_EMAIL = 'visibyl.biz@gmail.com';

type Body = {
  event?: string;
  staffName?: string;
  staffEmail?: string;
  department?: string;
  requestedRole?: string;
  commissionAmount?: number;
  commissionReference?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}

export default async function handler(req: IncomingMessage & { method?: string; body?: Body; headers: IncomingMessage['headers'] }, res: ServerResponse & { status?: (code: number) => ServerResponse; json?: (body: unknown) => void }) {
  const send = (code: number, payload: unknown) => {
    if (res.status && res.json) return res.status(code).json(payload);
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  };

  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return send(503, { error: 'Email service is not configured. Add RESEND_API_KEY in Vercel.' });

  try {
    let body = req.body;
    if (!body) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Body;
    }

    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) return send(401, { error: 'Firebase sign-in is required.' });
    const idToken = authorization.slice(7);

    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!lookup.ok) return send(401, { error: 'Your Firebase session is invalid. Sign in again.' });
    const identity = await lookup.json() as { users?: Array<{ localId: string; email?: string; emailVerified?: boolean }> };
    const user = identity.users?.[0];
    if (!user?.email || !user.emailVerified) return send(403, { error: 'A verified account is required.' });

    const event = body?.event;
    const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
    const isStaffApplication = event === 'staff_application';
    if (!isStaffApplication && !isAdmin) return send(403, { error: 'Only Super Admin can send this notification.' });

    const sandboxMode = !process.env.RESEND_FROM_EMAIL;
    const from = process.env.RESEND_FROM_EMAIL || 'VISIBYL Operations <onboarding@resend.dev>';
    let to = ADMIN_EMAIL;
    let subject = '';
    let html = '';

    if (event === 'staff_application') {
      subject = 'New VISIBYL staff access application';
      html = `<h2>New staff application</h2><p><b>Name:</b> ${escapeHtml(body.staffName || 'Not provided')}</p><p><b>Email:</b> ${escapeHtml(body.staffEmail || user.email)}</p><p><b>Department:</b> ${escapeHtml(body.department || 'Not provided')}</p><p><b>Requested role:</b> ${escapeHtml(body.requestedRole || 'Not provided')}</p><p>Sign in to VISIBYL Ops to review and approve this request.</p>`;
    } else if (event === 'customer_onboarding_submitted') {
      subject = 'New VISIBYL customer onboarding form submitted';
      html = `<h2>New customer onboarding submission</h2><p><b>Contact:</b> ${escapeHtml(body.staffName || 'Not provided')}</p><p><b>Email:</b> ${escapeHtml(body.staffEmail || user.email)}</p><p><b>Business:</b> ${escapeHtml(body.department || 'Not provided')}</p><p><b>Service:</b> ${escapeHtml(body.requestedRole || 'Not provided')}</p><p>Sign in to VISIBYL Ops to review the complete form and uploaded business logo.</p>`;
    } else if (event === 'staff_approved' || event === 'staff_rejected') {
      subject = event === 'staff_approved' ? 'VISIBYL staff application approved' : 'VISIBYL staff application update';
      html = `<h2>${event === 'staff_approved' ? 'Staff application approved' : 'Staff application not approved'}</h2><p>Name: ${escapeHtml(body.staffName || '')}</p><p>Staff email: ${escapeHtml(body.staffEmail || '')}</p><p>Sandbox test notification. In production, this will be delivered to the staff member after a verified sender domain is configured.</p>`;
      if (!sandboxMode && body.staffEmail) to = body.staffEmail;
    } else if (event === 'commission_paid') {
      subject = 'VISIBYL commission payout recorded';
      if (!sandboxMode && body.staffEmail) to = body.staffEmail;
      html = `<h2>Commission payout recorded</h2><p>Staff: ${escapeHtml(body.staffName || '')}</p><p>Amount: ₦${Number(body.commissionAmount || 0).toLocaleString('en-NG')}</p><p>Reference: ${escapeHtml(body.commissionReference || 'Not provided')}</p><p>Sandbox test notification.</p>`;
    } else {
      return send(400, { error: 'Unsupported notification event.' });
    }

    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const resultBody = await result.json().catch(() => ({}));
    if (!result.ok) {
      console.error('Resend delivery error:', result.status, resultBody);
      return send(502, { error: 'Resend could not send the email. Check the API key and sender configuration.', details: resultBody });
    }
    return send(200, { success: true, sandboxMode, recipient: to, result: resultBody });
  } catch (error) {
    console.error('Email notification error:', error);
    return send(500, { error: 'Email notification failed.' });
  }
}
