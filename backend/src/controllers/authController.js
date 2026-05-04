const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomBytes(4).toString('hex') } : { v4: () => Math.random().toString(36).slice(2, 10) };
const db = require('../../config/database');

const sign = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

const safeUser = (u) => ({ id: u.id, name: u.name, email: u.email, balance: u.balance, referral_code: u.referral_code });

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, referral_code } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const exists = await db('users').where({ email: email.toLowerCase() }).first();
    if (exists) return res.status(409).json({ message: 'Email already registered.' });

    const hash = await bcrypt.hash(password, 10);
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();

    const [user] = await db('users').insert({
      name,
      email: email.toLowerCase(),
      password_hash: hash,
      referral_code: code,
      balance: 0,
    }).returning('*');

    if (referral_code) {
      const referrer = await db('users').where({ referral_code: referral_code.toUpperCase() }).first();
      if (referrer) {
        await db('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, commission_earned: 0 });
        await db('earnings').insert({ user_id: referrer.id, task_id: null, amount: 50, type: 'referral_signup', description: `Referral signup bonus — ${name}` });
        await db('users').where({ id: referrer.id }).increment('balance', 50);
      }
    }

    res.status(201).json({ token: sign(user), user: safeUser(user) });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

    const user = await db('users').where({ email: email.toLowerCase() }).first();
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });

    res.json({ token: sign(user), user: safeUser(user) });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(safeUser(user));
  } catch (err) { next(err); }
};

exports.stats = async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);

    const [today] = await db('earnings').where({ user_id: req.user.id }).where('created_at', '>=', todayStart).sum('amount as total');
    const [week] = await db('earnings').where({ user_id: req.user.id }).where('created_at', '>=', weekStart).sum('amount as total');
    const [total] = await db('earnings').where({ user_id: req.user.id }).sum('amount as total');

    res.json({
      balance: user.balance,
      today: today.total || 0,
      week: week.total || 0,
      total: total.total || 0,
    });
  } catch (err) { next(err); }
};
