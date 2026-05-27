export interface AuthPayload {
  id: number;
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface DbUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  referral_code: string;
  balance: number;
  is_active: boolean;
  is_admin: boolean;
  email_verified: boolean;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  last_login_at: Date | null;
  last_login_ip: string | null;
  registration_ip: string | null;
  totp_secret: string | null;
  totp_enabled: boolean;
  plan: UserPlan;
  plan_expires_at: Date | null;
  avatar_url: string | null;
  withdrawal_credits: number;
  payment_method_cleared_at?: Date | null;
  kyc_status: KycStatus;
  kyc_submitted_at: Date | null;
  kyc_reviewed_at: Date | null;
  kyc_rejection_reason: string | null;
  welcome_bonus_claimed_at: Date | null;
  kitagrow_balance: number;
  created_at: Date;
  updated_at: Date;
}

export type InvestmentStatus = 'pending' | 'active' | 'matured' | 'rejected';

export interface DbInvestment {
  id: number;
  user_id: number;
  term_days: number;
  amount: number;
  payout_amount: number;
  reference: string;
  screenshot_url: string | null;
  status: InvestmentStatus;
  admin_note: string | null;
  reviewed_by: number | null;
  activated_at: Date | null;
  matures_at: Date | null;
  paid_out_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type KitagrowWithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface DbKitagrowWithdrawal {
  id: number;
  user_id: number;
  amount: number;
  channel: string;
  account_number: string;
  account_name: string;
  status: KitagrowWithdrawalStatus;
  admin_note: string | null;
  reviewed_by: number | null;
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
export type WithdrawalChannel = 'gcash';
export type UserPlan = 'free' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface DbWithdrawal {
  id: number;
  user_id: number;
  amount: number;
  fee: number;
  net_amount: number;
  channel: WithdrawalChannel;
  account_number: string;
  account_name?: string | null;
  status: WithdrawalStatus;
  ip_address?: string | null;
  is_flagged?: boolean;
  metadata?: Record<string, unknown> | null;
  paypal_batch_id?: string | null;
  paypal_payout_item_id?: string | null;
  payout_attempted_at?: Date | null;
  payout_error?: string | null;
  created_at: Date;
}

export interface DbEarning {
  id: number;
  user_id: number;
  task_id: number | null;
  amount: number;
  type: 'task' | 'referral_signup' | 'spin' | 'admin_adjustment' | 'checkin';
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

export interface DbOtpToken {
  id: number;
  user_id: number;
  token_hash: string;
  purpose: 'email_verify' | 'withdrawal_otp' | 'password_reset';
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export interface DbRefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export interface DbLoginEvent {
  id: number;
  user_id: number;
  success: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface DbAuditLog {
  id: number;
  user_id: number;
  action: string;
  amount: number | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}
