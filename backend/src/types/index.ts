export interface AuthPayload {
  id: number;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export interface DbUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  referral_code: string;
  balance: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DbTask {
  id: number;
  title: string;
  description: string;
  category: 'survey' | 'app_install' | 'video' | 'microjob' | 'game';
  payout: number;
  is_active: boolean;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type WithdrawalChannel = 'gcash' | 'maya' | 'gotyme' | 'bpi' | 'bdo' | 'unionbank' | 'coins' | 'usdt';

export interface DbWithdrawal {
  id: number;
  user_id: number;
  amount: number;
  fee: number;
  net_amount: number;
  channel: WithdrawalChannel;
  account_number: string;
  status: WithdrawalStatus;
  created_at: Date;
}

export interface DbEarning {
  id: number;
  user_id: number;
  task_id: number | null;
  amount: number;
  type: 'task' | 'referral_signup' | 'referral_commission' | 'spin';
  description: string;
  created_at: Date;
}

export interface DbReferral {
  id: number;
  referrer_id: number;
  referred_id: number;
  commission_earned: number;
  created_at: Date;
}
