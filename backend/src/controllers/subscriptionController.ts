import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import db from '../../config/database';
import { DbUser, UserPlan, DbWithdrawal, WithdrawalStatus } from '../types';
import { logAudit } from '../services/audit';
import { sendPlanUpgradeEmail, sendWithdrawalStatusEmail, sendGcashPaymentNotificationEmail, sendGcashPaymentReceivedEmail } from '../services/email';
import { paypalBase, getPayPalToken } from '../services/paypal';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PLAN_PRICES: Record<Exclude<UserPlan, 'free'>, { amount: string; label: string }> = {
  bronze:  { amount: '199.00', label: 'Kitazon Bronze Plan' },
  silver:  { amount: '499.00', label: 'Kitazon Silver Plan' },
  gold:    { amount: '1299.00', label: 'Kitazon Gold Plan' },
  diamond: { amount: '1999.00', label: 'Kitazon Diamond Plan' },
};

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

    // Try updating with plan_expires_at; fall back to plan-only if column doesn't exist yet
    try {
      await db<DbUser>('users').where({ id: req.user!.id }).update({
        plan: plan as UserPlan,
        plan_expires_at: planExpiresAt,
      });
    } catch (dbErr) {
      console.warn('[Plan upgrade] plan_expires_at update failed, retrying without it:', dbErr);
      await db<DbUser>('users').where({ id: req.user!.id }).update({ plan: plan as UserPlan });
    }

    await logAudit(req.user!.id, 'plan_upgrade', req, { metadata: { plan, paypal_order_id: orderId_confirmed } });

    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    console.log(`[Plan upgrade] userId=${req.user!.id} plan=${plan} db_plan=${user?.plan}`);

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
      resource?: {
        custom_id?: string;
        sender_item_id?: string;
        payout_item_id?: string;
        payout_batch_id?: string;
        transaction_status?: string;
        errors?: { message?: string; name?: string };
      };
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
            try {
              await db<DbUser>('users').where({ id: userId }).update({ plan, plan_expires_at: planExpiresAt });
            } catch {
              await db<DbUser>('users').where({ id: userId }).update({ plan });
            }

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

    // ─── Automated payout events ──────────────────────────────────────────
    // sender_item_id is set to "withdrawal:<id>" when we initiate a payout.
    if (
      event.event_type === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED' ||
      event.event_type === 'PAYMENT.PAYOUTS-ITEM.FAILED' ||
      event.event_type === 'PAYMENT.PAYOUTS-ITEM.DENIED' ||
      event.event_type === 'PAYMENT.PAYOUTS-ITEM.RETURNED' ||
      event.event_type === 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED'
    ) {
      const senderItemId = event.resource?.sender_item_id ?? '';
      const m = /^withdrawal:(\d+)$/.exec(senderItemId);
      if (m) {
        const withdrawalId = Number(m[1]);
        const succeeded = event.event_type === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED';
        const newStatus: WithdrawalStatus = succeeded ? 'completed' : 'failed';

        try {
          const withdrawal = await db<DbWithdrawal>('withdrawals').where({ id: withdrawalId }).first();
          if (withdrawal && withdrawal.status !== newStatus) {
            await db.transaction(async (trx) => {
              const updates: Record<string, unknown> = { status: newStatus };
              try {
                updates.payout_error = succeeded ? null : (event.resource?.errors?.message ?? event.event_type);
                await trx('withdrawals').where({ id: withdrawalId }).update(updates);
              } catch {
                // payout_error column not yet migrated — fall back
                await trx('withdrawals').where({ id: withdrawalId }).update({ status: newStatus });
              }

              // Refund balance on failure (only if not already failed)
              if (!succeeded && withdrawal.status !== 'failed') {
                await trx('users').where({ id: withdrawal.user_id }).increment('balance', Number(withdrawal.amount));
              }
            });

            const owner = await db<DbUser>('users').where({ id: withdrawal.user_id }).select('email', 'name').first();
            if (owner) {
              sendWithdrawalStatusEmail(
                owner.email, owner.name, newStatus,
                Number(withdrawal.amount), withdrawal.channel, Number(withdrawal.net_amount)
              ).catch(() => {});
            }

            console.log(`[PayPal Webhook] Payout ${newStatus}: withdrawal_id=${withdrawalId} event=${event.event_type}`);
          }
        } catch (payoutErr) {
          console.error('[PayPal Webhook] Failed to update payout status:', payoutErr);
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

/* ── POST /api/subscriptions/gcash-submit ───────────────────────────────────── */
export async function getGcashPendingPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await db('gcash_payments')
      .where({ user_id: req.user!.id, status: 'pending' })
      .select('plan');
    res.json({ pending_plans: rows.map((r: { plan: string }) => r.plan) });
  } catch (err) { next(err); }
}

export async function submitGcashPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { plan, reference, screenshot_data } = req.body as {
      plan?: string; reference?: string; screenshot_data?: string;
    };

    if (!plan || !(plan in PLAN_PRICES)) {
      res.status(400).json({ message: 'Invalid plan selected.' });
      return;
    }
    const ref = typeof reference === 'string' ? reference.trim() : '';
    if (ref.length < 5) {
      res.status(400).json({ message: 'Please enter a valid GCash reference number (at least 5 characters).' });
      return;
    }

    const cfg = PLAN_PRICES[plan as Exclude<UserPlan, 'free'>];

    // Upload screenshot to Cloudinary if provided
    let screenshotUrl: string | null = null;
    if (screenshot_data && typeof screenshot_data === 'string' && screenshot_data.startsWith('data:image/')) {
      try {
        const result = await cloudinary.uploader.upload(screenshot_data, {
          folder: 'gcash_receipts',
          public_id: `${req.user!.id}_${Date.now()}`,
          overwrite: false,
          resource_type: 'image',
        });
        screenshotUrl = result.secure_url;
      } catch { /* screenshot upload failed — continue without it */ }
    }

    // Persist to gcash_payments table
    await db('gcash_payments').insert({
      user_id: req.user!.id,
      plan,
      amount: cfg.amount,
      reference: ref,
      screenshot_url: screenshotUrl,
      status: 'pending',
    });

    await logAudit(req.user!.id, 'gcash_payment_submitted', req, {
      metadata: { plan, reference: ref, amount: cfg.amount },
    });

    // Notify admin + confirm to user (fire-and-forget)
    const user = await db<DbUser>('users').where({ id: req.user!.id }).first();
    if (user) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        sendGcashPaymentNotificationEmail(
          adminEmail, user.name, user.email, user.id, plan, cfg.amount, ref,
        ).catch(() => {});
      }
      sendGcashPaymentReceivedEmail(user.email, user.name, plan, cfg.amount, ref).catch(() => {});
    }

    res.json({ message: 'Payment submitted! Admin will verify your GCash payment and activate your plan within 24 hours.' });
  } catch (err) { next(err); }
}
