import { Request, Response, NextFunction } from 'express';
import db from '../../config/database';
import { DbUser, UserPlan } from '../types';
import { logAudit } from '../services/audit';
import { sendPlanUpgradeEmail } from '../services/email';

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
          custom_id: `${req.user!.id}:${plan}`,
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

    let orderId_confirmed = orderId;

    if (!capture.ok) {
      const errText = await capture.text();
      console.error('PayPal capture error:', capture.status, errText);

      // ORDER_ALREADY_CAPTURED means payment went through — verify order status instead
      if (capture.status === 422 || errText.includes('ORDER_ALREADY_CAPTURED') || errText.includes('ORDER_ALREADY_COMPLETED')) {
        const orderRes = await fetch(`${paypalBase()}/v2/checkout/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (orderRes.ok) {
          const orderData = await orderRes.json() as { status: string; id: string };
          if (orderData.status === 'COMPLETED') {
            orderId_confirmed = orderData.id;
            // Fall through to plan upgrade below
          } else {
            res.status(402).json({ message: 'Payment not completed.' });
            return;
          }
        } else {
          res.status(502).json({ message: 'Payment capture failed.' });
          return;
        }
      } else {
        res.status(502).json({ message: 'Payment capture failed.' });
        return;
      }
    } else {
      const captureData = await capture.json() as { status: string; id: string };
      if (captureData.status !== 'COMPLETED') {
        res.status(402).json({ message: `Payment not completed. Status: ${captureData.status}` });
        return;
      }
      orderId_confirmed = captureData.id;
    }

    const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db<DbUser>('users').where({ id: req.user!.id }).update({
      plan: plan as UserPlan,
      plan_expires_at: planExpiresAt,
    });
    await logAudit(req.user!.id, 'plan_upgrade', req, { metadata: { plan, paypal_order_id: orderId_confirmed } });

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();

    // Send upgrade confirmation email (fire-and-forget)
    if (user) {
      sendPlanUpgradeEmail(user.email, user.name, plan, planExpiresAt).catch(() => {});
    }

    res.json({ message: 'Plan upgraded successfully.', plan, user: { plan: user?.plan } });
  } catch (err) { next(err); }
}

/* ── POST /api/subscriptions/webhook ────────────────────────────────────────── */
export async function paypalWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const event = req.body as {
      event_type?: string;
      resource?: { custom_id?: string };
    };

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const customId = event.resource?.custom_id;
      if (customId) {
        const parts = customId.split(':');
        const userId = Number(parts[0]);
        const plan = parts[1] as UserPlan;

        if (userId && plan && plan in { silver: 1, gold: 1, diamond: 1 }) {
          try {
            const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await db<DbUser>('users').where({ id: userId }).update({
              plan,
              plan_expires_at: planExpiresAt,
            });

            const user = await db<DbUser>('users').where({ id: userId }).first();
            if (user) {
              sendPlanUpgradeEmail(user.email, user.name, plan, planExpiresAt).catch(() => {});
            }

            console.log(`[PayPal Webhook] Plan upgraded: userId=${userId} plan=${plan}`);
          } catch (updateErr) {
            console.error('[PayPal Webhook] Failed to update user plan:', updateErr);
          }
        }
      }
    }

    // Always respond 200 — PayPal retries on non-200
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[PayPal Webhook] Unexpected error:', err);
    res.status(200).json({ received: true });
  }
}
