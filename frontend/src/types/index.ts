export type UserPlan = 'free' | 'silver' | 'gold' | 'diamond';

export interface User {
  id: number;
  name: string;
  email: string;
  balance: number | string;
  referral_code: string;
  email_verified: boolean;
  is_admin?: boolean;
  totp_enabled?: boolean;
  last_login_at?: string | null;
  plan?: UserPlan;
  plan_expires_at?: string | null;
  avatar_url?: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  category: 'survey' | 'app_install' | 'video' | 'microjob' | 'game';
  payout: number | string;
  is_active: boolean;
  is_completed?: boolean;
  created_at?: string;
}

export interface Earning {
  id: number;
  amount: number | string;
  type: string;
  created_at: string;
  task_title: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type WithdrawalChannel = 'gcash';

export interface Withdrawal {
  id: number;
  amount: number | string;
  fee: number | string;
  net_amount: number | string;
  channel: WithdrawalChannel;
  account_number: string;
  status: WithdrawalStatus;
  created_at: string;
}

export interface Payout {
  id: number;
  amount: number | string;
  channel: WithdrawalChannel;
  created_at: string;
  masked_name: string;
}

export interface UserStats {
  balance: number | string;
  today: number | string;
  week: number | string;
  total: number | string;
}

export interface ReferralStats {
  referral_code: string;
  referral_count: number | string;
  lifetime_earnings: number | string;
}

export interface ReferralEntry {
  id: number;
  name: string;
  commission_earned: number | string;
  created_at: string;
}
