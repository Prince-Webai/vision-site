// Stripe integration — stubbed payment link generator. Drop in STRIPE_SECRET_KEY to enable.

export interface PaymentLinkInput {
  jobNumber: string;
  amountCents: number;
  currency?: string;
  description?: string;
  customerEmail?: string;
}

export interface PaymentLinkResult {
  ok: boolean;
  provider: 'stripe' | 'stub';
  url?: string;
  id?: string;
  error?: string;
}

export async function createPaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  const currency = input.currency || 'aud';

  if (!key) {
    const fakeId = `stub_${Date.now()}`;
    return {
      ok: true,
      provider: 'stub',
      id: fakeId,
      url: `https://checkout.stripe.example/pay/${fakeId}?amount=${input.amountCents}&currency=${currency}`,
    };
  }

  try {
    // Stripe requires a Price → PaymentLink. For simplicity here we use a one-shot
    // line_items with inline price_data via the Payment Links API.
    const body = new URLSearchParams();
    body.append('line_items[0][price_data][currency]', currency);
    body.append('line_items[0][price_data][product_data][name]', `Invoice ${input.jobNumber}`);
    body.append('line_items[0][price_data][unit_amount]', String(input.amountCents));
    body.append('line_items[0][quantity]', '1');

    const res = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const error = await res.text();
      return { ok: false, provider: 'stripe', error };
    }
    const data = await res.json();
    return { ok: true, provider: 'stripe', id: data.id, url: data.url };
  } catch (err) {
    return { ok: false, provider: 'stripe', error: String(err) };
  }
}
