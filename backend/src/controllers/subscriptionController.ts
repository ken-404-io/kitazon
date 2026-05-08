import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser, UserPlan } from '../types';
import { logAudit } from '../services/audit';

const PLAN_PRICES: Record<Exclude<UserPlan, 'free'>, { amount: string; label: string }> = {
  silver:  { amount: '99.00',  label: 'Kitazon Silver Plan' },
  gold:    { amount: '199.00', label: 'Kitazon Gold Plan' },
  diamond: { amount: '399.00', label: 'Kitazon Diamond Plan' },
};

function paypalBase(): string {
  return process.env.PAYPAL_MODE === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';
}

async function getPayPalToken(): Promise<string> {
  const base  = paypalBase();
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  console.log(`[PayPal] getToken mode=${process.env.PAYPAL_MODE ?? 'production'} base=${base}`);

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

/* ── POST /api/subscriptions/create ─────────────────────────────────────────── */
export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { plan } = req.body as { plan?: string };
    if (!plan || !(plan in PLAN_PRICES)) {
      res.status(400).json({ message: 'Invalid plan selected.' });
      return;
    }

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      res.status(503).json({ message: 'Payment gateway is not configured.' });
      return;
    }

    const FRONTEND = process.env.FRONTEND_URL ?? 'https://www.kitazon.com';
    const cfg = PLAN_PRICES[plan as Exclude<UserPlan, 'free'>];
    const token = await getPayPalToken();

    const order = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: cfg.label,
          amount: { currency_code: 'PHP', value: cfg.amount },
        }],
        application_context: {
          brand_name: 'Kitazon',
          locale: 'en-PH',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: `${FRONTEND}/payment/success?plan=${plan}`,
          cancel_url: `${FRONTEND}/payment/cancel`,
        },
      }),
    });

    if (!order.ok) {
      const err = await order.text();
      console.error('PayPal create order error:', err);
      res.status(502).json({ message: 'Failed to create payment order.' });
      return;
    }

    const orderData = await order.json() as {
      id: string;
      links: { href: string; rel: string }[];
    };
    const approvalLink = orderData.links.find(l => l.rel === 'approve');
    if (!approvalLink) {
      res.status(502).json({ message: 'No approval URL returned from PayPal.' });
      return;
    }

    res.json({ orderId: orderData.id, approvalUrl: approvalLink.href });
  } catch (err) {
    console.error('[PayPal] createOrder error:', err);
    next(err);
  }
}

/* ── POST /api/subscriptions/capture ────────────────────────────────────────── */
export async function captureOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderId, plan } = req.body as { orderId?: string; plan?: string };

    if (!orderId || !plan || !(plan in PLAN_PRICES)) {
      res.status(400).json({ message: 'orderId and valid plan are required.' });
      return;
    }

    const token = await getPayPalToken();
    const capture = await fetch(`${paypalBase()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!capture.ok) {
      const err = await capture.text();
      console.error('PayPal capture error:', err);
      res.status(502).json({ message: 'Payment capture failed.' });
      return;
    }

    const captureData = await capture.json() as { status: string; id: string };
    if (captureData.status !== 'COMPLETED') {
      res.status(402).json({ message: `Payment not completed. Status: ${captureData.status}` });
      return;
    }

    await db<DbUser>('users').where({ id: req.user!.id }).update({ plan: plan as UserPlan });
    await logAudit(req.user!.id, 'plan_upgrade', req, { metadata: { plan, paypal_order_id: captureData.id } });

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    res.json({ message: 'Plan upgraded successfully.', plan, user: { plan: user?.plan } });
  } catch (err) { next(err); }
}
