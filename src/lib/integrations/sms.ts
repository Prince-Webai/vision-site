// SMS integration — stubbed Twilio client. Drop in TWILIO_* env vars to enable.

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsResult {
  ok: boolean;
  provider: 'twilio' | 'stub';
  messageSid?: string;
  error?: string;
}

export async function sendSms(msg: SmsMessage): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.log('[sms:stub] Would send →', { to: msg.to, body: msg.body });
    return { ok: true, provider: 'stub', messageSid: `stub-${Date.now()}` };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const body = new URLSearchParams({ To: msg.to, From: from, Body: msg.body });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const error = await res.text();
      return { ok: false, provider: 'twilio', error };
    }
    const data = await res.json();
    return { ok: true, provider: 'twilio', messageSid: data.sid };
  } catch (err) {
    return { ok: false, provider: 'twilio', error: String(err) };
  }
}
