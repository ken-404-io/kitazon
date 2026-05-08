import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { generalLimiter, authLimiter } from './middleware/rateLimiter';
import sanitize from './middleware/sanitize';
import errorHandler from './middleware/errorHandler';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import withdrawalRoutes from './routes/withdrawals';
import referralRoutes from './routes/referrals';
import payoutRoutes from './routes/payouts';
import accountRoutes from './routes/account';
import adminRoutes from './routes/admin';
import totpRoutes from './routes/totp';
import affiliateRoutes from './routes/affiliate';

// ─── Startup guards ────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short (min 32 chars). Refusing to start.');
  process.exit(1);
}
if (!process.env.FRONTEND_URL) {
  console.warn('WARNING: FRONTEND_URL is not set. CORS will only allow http://localhost:3000.');
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  FRONTEND_URL.replace('https://www.', 'https://'),
  FRONTEND_URL.replace('https://', 'https://www.'),
  FRONTEND_URL.replace('https://', 'http://'),
  FRONTEND_URL.replace('https://www.', 'http://www.'),
  'http://localhost:3000',
].filter((v, i, a) => a.indexOf(v) === i);

const app = express();

// Trust proxy in dev so express-rate-limit can read X-Forwarded-For correctly
app.set('trust proxy', 1);

// ─── Request ID + structured access log ──────────────────────────────────────
app.use((req, res, next) => {
  const id = crypto.randomUUID();
  const start = Date.now();
  res.setHeader('X-Request-ID', id);
  res.on('finish', () => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '-';
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms ip=${ip} rid=${id}`);
  });
  next();
});

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

// ─── API-specific headers ────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');          // keep API out of search indexes
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // cache preflight for 24 h
}));

// ─── DNS-rebinding / Host header guard ───────────────────────────────────────
const ALLOWED_HOSTS = new Set([
  new URL(FRONTEND_URL).hostname,
  'api.kitazon.com',
  'localhost',
  '127.0.0.1',
].filter(Boolean));

app.use((req: Request, res: Response, next: NextFunction): void => {
  const host = (req.headers.host ?? '').split(':')[0];
  if (!ALLOWED_HOSTS.has(host)) {
    res.status(400).json({ message: 'Invalid host.' });
    return;
  }
  next();
});

// ─── Body / cookie parsing ────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Reject mutation requests that are not application/json
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'] ?? '';
    if (!ct.includes('application/json')) {
      res.status(415).json({ message: 'Content-Type must be application/json.' });
      return;
    }
  }
  next();
});

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(sanitize);
app.use(generalLimiter);
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', authLimiter, adminRoutes);
app.use('/api/totp', totpRoutes);
app.use('/api/affiliate', affiliateRoutes);

// ─── security.txt (RFC 9116) ──────────────────────────────────────────────────
app.get('/.well-known/security.txt', (_req, res) => {
  res.type('text/plain').send(
    `Contact: mailto:security@kitazon.com\nExpires: ${new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()}\nPreferred-Languages: en\n`
  );
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 5000);
app.listen(PORT, () => console.log(`Kitazon API running on port ${PORT}`));
