const db = require('../../config/database');

exports.list = async (req, res, next) => {
  try {
    const query = db('tasks').where({ is_active: true }).orderBy('payout', 'desc');
    if (req.query.category) query.where({ category: req.query.category });
    const tasks = await query;
    res.json(tasks);
  } catch (err) { next(err); }
};

exports.complete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await db('tasks').where({ id, is_active: true }).first();
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const alreadyDone = await db('earnings').where({ user_id: req.user.id, task_id: id }).first();
    if (alreadyDone) return res.status(409).json({ message: 'You already completed this task.' });

    await db.transaction(async trx => {
      await trx('earnings').insert({ user_id: req.user.id, task_id: id, amount: task.payout, type: 'task', description: task.title });
      await trx('users').where({ id: req.user.id }).increment('balance', task.payout);

      const referral = await trx('referrals').where({ referred_id: req.user.id }).first();
      if (referral) {
        const commission = parseFloat((task.payout * 0.20).toFixed(2));
        await trx('referrals').where({ id: referral.id }).increment('commission_earned', commission);
        await trx('earnings').insert({ user_id: referral.referrer_id, task_id: id, amount: commission, type: 'referral_commission', description: `Referral commission — ${task.title}` });
        await trx('users').where({ id: referral.referrer_id }).increment('balance', commission);
      }
    });

    res.json({ message: 'Task completed!', amount: task.payout });
  } catch (err) { next(err); }
};

exports.spin = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const spunToday = await db('earnings').where({ user_id: req.user.id, type: 'spin' }).where('created_at', '>=', today).first();
    if (spunToday) return res.status(409).json({ message: 'Already spun today. Come back tomorrow!' });

    const PRIZES = [5, 5, 10, 10, 15, 20, 25, 50, 75, 100];
    const amount = PRIZES[Math.floor(Math.random() * PRIZES.length)];

    await db.transaction(async trx => {
      await trx('earnings').insert({ user_id: req.user.id, task_id: null, amount, type: 'spin', description: 'Daily spin wheel' });
      await trx('users').where({ id: req.user.id }).increment('balance', amount);
    });

    res.json({ amount });
  } catch (err) { next(err); }
};

exports.recentEarnings = async (req, res, next) => {
  try {
    const earnings = await db('earnings')
      .where({ 'earnings.user_id': req.user.id })
      .leftJoin('tasks', 'earnings.task_id', 'tasks.id')
      .select('earnings.id', 'earnings.amount', 'earnings.type', 'earnings.created_at', db.raw("COALESCE(tasks.title, earnings.description) as task_title"))
      .orderBy('earnings.created_at', 'desc')
      .limit(10);
    res.json(earnings);
  } catch (err) { next(err); }
};
