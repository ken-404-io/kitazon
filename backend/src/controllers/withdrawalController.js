const db = require('../../config/database');

const VALID_CHANNELS = ['gcash', 'maya', 'gotyme', 'bpi', 'bdo', 'unionbank', 'coins', 'usdt'];

exports.create = async (req, res, next) => {
  try {
    const { amount, channel, account_number } = req.body;
    const parsed = parseFloat(amount);

    if (!parsed || parsed < 50) return res.status(400).json({ message: 'Minimum withdrawal is ₱50.' });
    if (!VALID_CHANNELS.includes(channel)) return res.status(400).json({ message: 'Invalid payment channel.' });
    if (!account_number) return res.status(400).json({ message: 'Account number is required.' });

    const user = await db('users').where({ id: req.user.id }).first();
    if (user.balance < parsed) return res.status(400).json({ message: 'Insufficient balance.' });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthTotal] = await db('withdrawals').where({ user_id: req.user.id, status: 'completed' }).where('created_at', '>=', monthStart).sum('amount as total');
    const cumulative = parseFloat(monthTotal.total || 0);
    const fee = cumulative >= 500 ? 5 : 0;
    const netAmount = parsed - fee;

    if (netAmount <= 0) return res.status(400).json({ message: 'Amount too low after fee deduction.' });

    await db.transaction(async trx => {
      await trx('users').where({ id: req.user.id }).decrement('balance', parsed);
      await trx('withdrawals').insert({ user_id: req.user.id, amount: parsed, fee, net_amount: netAmount, channel, account_number, status: 'pending' });
    });

    res.status(201).json({ message: 'Withdrawal submitted successfully.', fee, net_amount: netAmount });
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const withdrawals = await db('withdrawals').where({ user_id: req.user.id }).orderBy('created_at', 'desc');
    res.json(withdrawals);
  } catch (err) { next(err); }
};
