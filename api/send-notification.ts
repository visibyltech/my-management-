import type { IncomingMessage, ServerResponse } from 'http';
import firebaseConfig from '../firebase-applet-config.json';

const ADMIN_EMAIL = 'visibyl.biz@gmail.com';

type Body = {
  event?: string;
  staffName?: string;
  staffEmail?: string;
  department?: string;
  requestedRole?: string;
  customerName?: string;
  customerEmail?: string;
  businessName?: string;
  servicePurchased?: string;
  formCode?: string;
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
    const isOwnStaffApplication = event === 'staff_application' &&
      (body.staffEmail || '').toLowerCase() === user.email.toLowerCase();
    const isOwnCustomerSubmission = event === 'customer_onboarding_submitted' &&
      (body.customerEmail || '').toLowerCase() === user.email.toLowerCase();

    if (event === 'staff_application' && !isOwnStaffApplication) {
      return send(403, { error: 'Staff application email must match the signed-in account.' });
    }
    if (event === 'customer_onboarding_submitted' && !isAdmin && !isOwnCustomerSubmission) {
      return send(403, { error: 'Customer submission email must match the signed-in account.' });
    }
    if (!['staff_application', 'customer_onboarding_submitted'].includes(event || '') && !isAdmin) {
      return send(403, { error: 'Only Super Admin can send this notification.' });
    }

    const configuredFrom = process.env.RESEND_FROM_EMAIL;
    const sandboxMode = !configuredFrom;
    const from = configuredFrom || 'VISIBYL Operations <onboarding@resend.dev>';
    let to = ADMIN_EMAIL;
    let subject = '';
    let html = '';

    if (event === 'staff_application') {
      subject = 'New VISIBYL staff access application';
      html = `<h2>New staff application</h2><p><b>Name:</b> ${escapeHtml(body.staffName || 'Not provided')}</p><p><b>Email:</b> ${escapeHtml(body.staffEmail || user.email)}</p><p><b>Department:</b> ${escapeHtml(body.department || 'Not provided')}</p><p><b>Requested role:</b> ${escapeHtml(body.requestedRole || 'Not provided')}</p><p>Sign in to VISIBYL Ops to review and approve this request.</p>`;
    } else if (event === 'customer_onboarding_submitted') {
      subject = `New VISIBYL customer onboarding form: ${body.formCode || 'Submitted'}`;
      html = `<h2>New customer onboarding submission</h2><p><b>Customer:</b> ${escapeHtml(body.customerName || 'Not provided')}</p><p><b>Business:</b> ${escapeHtml(body.businessName || 'Not provided')}</p><p><b>Email:</b> ${escapeHtml(body.customerEmail || user.email)}</p><p><b>Service:</b> ${escapeHtml(body.servicePurchased || 'Not provided')}</p><p><b>Form:</b> ${escapeHtml(body.formCode || 'Not provided')}</p><p>Sign in to VISIBYL Ops to review the complete form and attachments.</p>`;
    } else if (event === 'staff_approved' || event === 'staff_rejected') {
      to = body.staffEmail || ADMIN_EMAIL;
      subject = event === 'staff_approved' ? 'Your VISIBYL staff application has been approved' : 'Update on your VISIBYL staff application';
      html = `<h2>${event === 'staff_approved' ? 'Welcome to VISIBYL Technologies' : 'Staff application update'}</h2><p>Hello ${escapeHtml(body.staffName || '')},</p><p>${event === 'staff_approved' ? 'Your staff application has been approved. You can now sign in to your VISIBYL Management account.' : 'Your staff access is not currently active. Please contact VISIBYL Technologies if you need more information.'}</p>`;
    } else if (event === 'customer_onboarding_reviewed') {
      to = body.customerEmail || ADMIN_EMAIL;
      subject = `Your VISIBYL onboarding form ${body.formCode || ''} has been reviewed`;
      html = `<h2>Onboarding form reviewed</h2><p>Hello ${escapeHtml(body.customerName || 'Customer')},</p><p>Your onboarding form ${escapeHtml(body.formCode || '')} for ${escapeHtml(body.businessName || 'your business')} has been reviewed by VISIBYL Technologies. Our team will contact you if further information is needed.</p>`;
    } else if (event === 'commission_paid') {
      to = body.staffEmail || ADMIN_EMAIL;
      subject = 'Your VISIBYL commission payout has been recorded';
      html = `<h2>Commission payout recorded</h2><p>Staff: ${escapeHtml(body.staffName || '')}</p><p>Amount: ₦${Number(body.commissionAmount || 0).toLocaleString('en-NG')}</p><p>Reference: ${escapeHtml(body.commissionReference || 'Not provided')}</p>`;
    } else {
      return send(400, { error: 'Unsupported notification event.' });
    }

    if (sandboxMode && to.toLowerCase() !== ADMIN_EMAIL) {
      return send(503, { error: 'Customer and staff delivery is waiting for the verified VISIBYL sending domain. Set RESEND_FROM_EMAIL after verifying visibyl.biz in Resend.' });
    }

    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const resultBody = await result.json().catch(() => ({}));
    if (!result.ok) {
      console.error('Resend delivery error:', result.status, resultBody);
      return send(502, { error: 'Resend could not send the email. Check the API key, verified sender domain, and sender address.', details: resultBody });
    }
    return send(200, { success: true, sandboxMode, recipient: to, result: resultBody });
  } catch (error) {
    console.error('Email notification error:', error);
    return send(500, { error: 'Email notification failed.' });
  }
}
