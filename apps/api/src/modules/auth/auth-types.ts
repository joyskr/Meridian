export type AuthChallengePurpose = 'email_verification' | 'password_reset';

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  token_hash: string;
  active_organization_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  last_seen_at: Date;
};

export type AuthChallengeRecord = {
  id: string;
  user_id: string;
  purpose: AuthChallengePurpose;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
};
