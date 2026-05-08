import rateLimit from 'express-rate-limit';

const json429 = (msg: string) => (_req: unknown, res: unknown) =>
  (res as { status: (c: number) => { json: (b: unknown) => void } }).status(429).json({ message: msg });

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: json429('Too many attempts. Please try again in 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  handler: json429('Too many registrations from this IP. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  handler: json429('Too many requests. Please slow down.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const taskLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  handler: json429('Too many task requests. Please slow down.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  handler: json429('Too many withdrawal requests. Maximum 5 per hour.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  handler: json429('Too many OTP requests. Please wait 10 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});
