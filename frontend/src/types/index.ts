export interface User {
  id: number;
  name: string;
  email: string;
  balance: number;
  referral_code: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  category: 'survey' | 'app_install' | 'video' | 'microjob' | 'game';
  payout: number;
  is_active: boolean;
}

export interface Earning {
  id: number;
  amount: number;
  type: string;
  created_at: string;
  task_title: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type WithdrawalChannel = 'gcash' | 'maya' | 'gotyme' | 'bpi' | 'bdo' | 'unionbank' | 'coins' | 'usdt';

export interface Withdrawal {
  id: number;
  amount: number;
  fee: number;
  net_amount: number;
  channel: WithdrawalChannel;
  account_number: string;
  status: WithdrawalStatus;
  created_at: string;
}

export interface Payout {
  id: number;
  amount: number;
  channel: WithdrawalChannel;
  created_at: string;
  masked_name: string;
}

export interface UserStats {
  balance: number;
  today: number;
  week: number;
  total: number;
}

export interface ReferralStats {
  referral_code: string;
  referral_count: number;
  lifetime_earnings: number;
}

export interface ReferralEntry {
  id: number;
  name: string;
  commission_earned: number;
  created_at: string;
}
