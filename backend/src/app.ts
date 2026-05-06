import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { generalLimiter } from './middleware/rateLimiter';
import sanitize from './middleware/sanitize';
import errorHandler from './middleware/errorHandler';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import withdrawalRoutes from './routes/withdrawals';
import referralRoutes from './routes/referrals';
import payoutRoutes from './routes/payouts';
import accountRoutes from './routes/account';
import adminRoutes from './routes/admin';

// ─── Startup guards ────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short (min 32 chars). Refusing to start.');
  process.exit(1);
}
if (!process.env.FRONTEND_URL) {
  console.warn('WARNING: FRONTEND_URL is not set. CORS will only allow http://localhost:3000.');
}

const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:3000';

const app = express();

// Trust proxy in dev so express-rate-limit can read X-Forwarded-For correctly
app.set('trust proxy', 1);

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
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

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

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 5000);
app.listen(PORT, () => console.log(`Kitazon API running on port ${PORT}`));
