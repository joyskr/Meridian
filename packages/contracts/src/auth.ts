export type AuthUser = {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string;
};

export type AuthSession = {
  id: string;
  expires_at: string;
  current: boolean;
};

export type AuthChallenge = {
  purpose: 'email_verification' | 'password_reset';
  expires_at: string;
};

export type SignUpRequest = {
  email: string;
  password: string;
};

export type SignUpResponse = {
  user: AuthUser;
  challenge: AuthChallenge;
};

export type VerifyEmailRequest = {
  token: string;
};

export type VerifyEmailResponse = {
  user: AuthUser;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: AuthUser;
  session: AuthSession;
};

export type CurrentSessionResponse = {
  user: AuthUser;
  session: AuthSession;
};

export type LogoutResponse = Record<string, never>;

export type PasswordResetRequest = {
  email: string;
};

export type PasswordResetRequestedResponse = {
  accepted: true;
};

export type PasswordResetCompletionRequest = {
  token: string;
  password: string;
};

export type PasswordResetCompletionResponse = {
  user: AuthUser;
};
