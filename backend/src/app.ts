import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import errorHandler from './middleware/errorHandler';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import withdrawalRoutes from './routes/withdrawals';
import referralRoutes from './routes/referrals';
import payoutRoutes from './routes/payouts';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/payouts', payoutRoutes);

app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 5000);
app.listen(PORT, () => console.log(`Kitazon API running on port ${PORT}`));
