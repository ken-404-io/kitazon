const db = require('../../config/database');

exports.get = async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();

    const [commissionRow] = await db('referrals').where({ referrer_id: req.user.id }).sum('commission_earned as total');
    const referralCount = await db('referrals').where({ referrer_id: req.user.id }).count('id as count').first();

    const list = await db('referrals')
      .where({ 'referrals.referrer_id': req.user.id })
      .join('users', 'referrals.referred_id', 'users.id')
      .select('referrals.id', 'users.name', 'referrals.commission_earned', 'referrals.created_at');

    res.json({
      stats: {
        referral_code: user.referral_code,
        referral_count: parseInt(referralCount.count),
        lifetime_earnings: commissionRow.total || 0,
      },
      list,
    });
  } catch (err) { next(err); }
};
