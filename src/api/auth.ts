import { apiRequest } from "@/api/client";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface OTPData {
  email: string;
  code: string;
}

export interface GoogleAuthData {
  credential: string;
}

export async function loginUser(credentials: LoginCredentials) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function registerUser(data: RegisterData) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifyOTP(data: OTPData) {
  return apiRequest("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resendOTP(email: string) {
  return apiRequest("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function googleSignIn(data: GoogleAuthData) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCurrentUser() {
  return apiRequest("/auth/me");
}
