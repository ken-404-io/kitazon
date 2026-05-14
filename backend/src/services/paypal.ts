export function paypalBase(): string {
  return process.env.PAYPAL_MODE === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export async function getPayPalToken(): Promise<string> {
  const base = paypalBase();
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[PayPal] token error ${res.status}:`, body);
    throw new Error(`PayPal auth failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

const USD_TO_PHP = Number(process.env.USD_TO_PHP_RATE ?? 57);

export interface PayoutResult {
  batchId: string;
  payoutItemId?: string;
  batchStatus: string;
  itemStatus?: string;
}

// Send a single PayPal payout. Uses USD; converts PHP at USD_TO_PHP_RATE.
export async function sendPayout(opts: {
  receiverEmail: string;
  amountPhp: number;
  senderItemId: string;       // unique id for idempotency (we use withdrawal:<id>)
  note?: string;
  emailSubject?: string;
}): Promise<PayoutResult> {
  if (!paypalConfigured()) {
    throw new Error('PayPal credentials are not configured.');
  }
  if (!USD_TO_PHP || USD_TO_PHP <= 0) {
    throw new Error('USD_TO_PHP_RATE is not configured.');
  }

  const usdAmount = (opts.amountPhp / USD_TO_PHP).toFixed(2);
  if (Number(usdAmount) <= 0) {
    throw new Error('Payout amount too small after FX conversion.');
  }

  const token = await getPayPalToken();
  const res = await fetch(`${paypalBase()}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // PayPal-Request-Id makes the call idempotent on retry
      'PayPal-Request-Id': opts.senderItemId,
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: opts.senderItemId,
        email_subject: opts.emailSubject ?? 'You have a payout from Kitazon',
        email_message: opts.note ?? 'Your Kitazon withdrawal has been processed.',
      },
      items: [{
        recipient_type: 'EMAIL',
        receiver: opts.receiverEmail,
        sender_item_id: opts.senderItemId,
        amount: { value: usdAmount, currency: 'USD' },
        note: opts.note ?? 'Kitazon withdrawal',
      }],
    }),
  });

  const body = await res.json() as {
    batch_header?: { payout_batch_id?: string; batch_status?: string };
    items?: Array<{ payout_item_id?: string; transaction_status?: string }>;
    name?: string;
    message?: string;
  };

  if (!res.ok || !body.batch_header?.payout_batch_id) {
    console.error('[PayPal Payouts] error', res.status, body);
    throw new Error(`PayPal payout failed: ${body.message ?? body.name ?? res.statusText}`);
  }

  return {
    batchId: body.batch_header.payout_batch_id,
    payoutItemId: body.items?.[0]?.payout_item_id,
    batchStatus: body.batch_header.batch_status ?? 'PENDING',
    itemStatus: body.items?.[0]?.transaction_status,
  };
}
