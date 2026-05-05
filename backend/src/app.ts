import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { generalLimiter } from './middleware/rateLimiter';
import sanitize from './middleware/sanitize';
import errorHandler from './middleware/errorHandler';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import withdrawalRoutes from './routes/withdrawals';
import referralRoutes from './routes/referrals';
import payoutRoutes from './routes/payouts';

// ─── Startup guard ────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short (min 32 chars). Refusing to start.');
  process.exit(1);
}

const app = express();

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
    },
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Body / request hardening ─────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(sanitize);
app.use(generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/payouts', payoutRoutes);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));

app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 5000);
app.listen(PORT, () => console.log(`Kitazon API running on port ${PORT}`));
