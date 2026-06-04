// Email integration — stubbed Resend client. Drop in RESEND_API_KEY to enable.
// Replace `sendStub` with the real Resend call when the key is configured.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}

export interface EmailResult {
  ok: boolean;
  provider: 'resend' | 'stub';
  messageId?: string;
  error?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'noreply@visionsolar.example';

  if (!apiKey) {
    console.log('[email:stub] Would send →', { to: msg.to, subject: msg.subject, from });
    return { ok: true, provider: 'stub', messageId: `stub-${Date.now()}` };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html }),
    });
    if (!res.ok) {
      const error = await res.text();
      return { ok: false, provider: 'resend', error };
    }
    const data = await res.json();
    return { ok: true, provider: 'resend', messageId: data.id };
  } catch (err) {
    return { ok: false, provider: 'resend', error: String(err) };
  }
}
