import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from '../../config/database';
import { DbUser } from '../types';
import { logAudit } from '../services/audit';

// USD → PHP conversion rate (update periodically or fetch live)
const USD_TO_PHP = Number(process.env.USD_TO_PHP_RATE ?? 57);

// Margin: pay user X% of what we earn from the network
const USER_SHARE = Number(process.env.AFFILIATE_USER_SHARE ?? 0.70); // 70% to user, 30% platform revenue

function phpAmount(usd: number): number {
  return parseFloat((usd * USD_TO_PHP * USER_SHARE).toFixed(2));
}

// ─── CPAlead ──────────────────────────────────────────────────────────────────
// Postback URL to set in CPAlead dashboard:
// https://yourdomain.com/api/affiliate/postback/cpalead
//   ?user_id={userid}&amount={revenue}&offer_id={offerid}
//   &transaction_id={transactionid}&secret=YOUR_CPALEAD_SECRET
export async function cpalead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user_id, amount, offer_id, transaction_id, secret } = req.query as Record<string, string>;

    const expected = process.env.CPALEAD_SECRET;
    if (!expected || secret !== expected) {
      res.status(403).send('INVALID');
      return;
    }

    await creditUser({ network: 'cpalead', userId: Number(user_id), offerId: offer_id, transactionId: transaction_id, usd: parseFloat(amount ?? '0'), req });
    res.send('OK');
  } catch (err) { next(err); }
}

// ─── Lootably ─────────────────────────────────────────────────────────────────
// Postback URL:
// https://yourdomain.com/api/affiliate/postback/lootably
//   ?user_id={user_id}&currency_amount={currency_amount}&offer_id={offer_id}
//   &transaction_id={transaction_id}&signature={signature}
export async function lootably(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user_id, currency_amount, offer_id, transaction_id, signature } = req.query as Record<string, string>;

    const secret = process.env.LOOTABLY_SECRET;
    if (!secret) { res.status(403).send('NOT_CONFIGURED'); return; }

    // Lootably signature: MD5(user_id + offer_id + transaction_id + secret)
    const expected = crypto.createHash('md5').update(`${user_id}${offer_id}${transaction_id}${secret}`).digest('hex');
    if (signature !== expected) { res.status(403).send('INVALID'); return; }

    await creditUser({ network: 'lootably', userId: Number(user_id), offerId: offer_id, transactionId: transaction_id, usd: parseFloat(currency_amount ?? '0'), req });
    res.send('OK');
  } catch (err) { next(err); }
}

// ─── OfferToro ────────────────────────────────────────────────────────────────
// Postback URL:
// https://yourdomain.com/api/affiliate/postback/offertoro
//   ?sub1={user_id}&amount={amount}&offer_id={offer_id}&tid={tid}&secret=YOUR_SECRET
export async function offertoro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sub1, amount, offer_id, tid, secret } = req.query as Record<string, string>;

    const expected = process.env.OFFERTORO_SECRET;
    if (!expected || secret !== expected) { res.status(403).send('INVALID'); return; }

    await creditUser({ network: 'offertoro', userId: Number(sub1), offerId: offer_id, transactionId: tid, usd: parseFloat(amount ?? '0'), req });
    res.send('OK');
  } catch (err) { next(err); }
}

// ─── Adscend Media ───────────────────────────────────────────────────────────
// Postback URL:
// https://yourdomain.com/api/affiliate/postback/adscend
//   ?uid={subid}&amount={revenue}&offer_id={offer_id}&transaction_id={aff_sub5}&secret=YOUR_SECRET
export async function adscend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { uid, amount, offer_id, transaction_id, secret } = req.query as Record<string, string>;

    const expected = process.env.ADSCEND_SECRET;
    if (!expected || secret !== expected) { res.status(403).send('INVALID'); return; }

    await creditUser({ network: 'adscend', userId: Number(uid), offerId: offer_id, transactionId: transaction_id, usd: parseFloat(amount ?? '0'), req });
    res.send('OK');
  } catch (err) { next(err); }
}

// ─── Shared credit logic ──────────────────────────────────────────────────────
interface CreditParams {
  network: string;
  userId: number;
  offerId: string;
  transactionId?: string;
  usd: number;
  req: Request;
}

async function creditUser({ network, userId, offerId, transactionId, usd, req }: CreditParams): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error('Invalid user_id');
  if (isNaN(usd) || usd <= 0) throw new Error('Invalid amount');

  const user = await db<DbUser>('users').where({ id: userId, is_active: true }).first();
  if (!user) throw new Error('User not found');

  const credited = phpAmount(usd);

  await db.transaction(async (trx) => {
    // Dedup: one credit per network+offer+user combination
    const existing = await trx('affiliate_completions')
      .where({ network, offer_id: offerId, user_id: userId })
      .first();
    if (existing) return; // Already credited — idempotent, return silently

    await trx('affiliate_completions').insert({
      user_id: userId, network, offer_id: offerId,
      transaction_id: transactionId ?? null,
      payout_usd: usd, credited_php: credited,
    });

    await trx('earnings').insert({
      user_id: userId, task_id: null, amount: credited,
      type: 'affiliate_offer',
      description: `${network.toUpperCase()} offer #${offerId}`,
    });

    await trx('users').where({ id: userId }).increment('balance', credited);
  });

  await logAudit(userId, 'affiliate_credit', req, {
    amount: credited,
    metadata: { network, offer_id: offerId, usd, credited_php: credited },
  });
}

// ─── Earnings summary for user ────────────────────────────────────────────────
export async function affiliateEarnings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [row] = await db('earnings')
      .where({ user_id: req.user!.id, type: 'affiliate_offer' })
      .sum('amount as total');
    const count = await db('affiliate_completions').where({ user_id: req.user!.id }).count('id as cnt').first();
    res.json({ total: Number(row?.total ?? 0), completed_offers: Number(count?.cnt ?? 0) });
  } catch (err) { next(err); }
}
