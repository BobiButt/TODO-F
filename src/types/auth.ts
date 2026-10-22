export interface LoginUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
  password_hash?: string;
  provider?: "email" | "google";
  google_id?: string | null;
  is_verified?: boolean;
  email_verified_at?: string | null;
  otp_code?: string | null;
  otp_expires_at?: string | null;
}
