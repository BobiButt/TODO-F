import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser, verifyOTP, resendOTP } from "@/api/auth";
import { setAuthToken } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      const token = (response as any).access_token;
      const user = (response as any).user;
      if (token && user) {
        setAuthToken(token);
        login(token, user);
        toast.success(`Welcome back, ${user.name}!`);
        navigate("/");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold text-white tracking-tight">
            T<span className="text-purple-400">askflow</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-gray-300">Sign in to your TaskFlow account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-200">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-200">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span>Signing in…</span> : <span>Sign in</span>}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="relative flex items-center gap-4">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-xs text-gray-400 uppercase tracking-wider">Or continue with</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        <GoogleSignInButton className="w-full" />

        <p className="text-center text-sm text-gray-400">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await registerUser({ name, email, password });
      toast.success("Account created! Please check your email for the verification code.");
      navigate("/verify-otp", { state: { email } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold text-white tracking-tight">
            T<span className="text-purple-400">askflow</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Create an account</h1>
          <p className="text-sm text-gray-300">Join TaskFlow and start organizing your tasks</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-200">Full name</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">👤</span>
              <input
                type="text"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-200">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-200">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span>Creating account…</span> : <span>Create account</span>}
            <ArrowRight size={16} />
          </button>
        </form>

        <GoogleSignInButton className="w-full" />

        <p className="text-center text-sm text-gray-400">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export function OTPPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const location = navigate as any;
    const state = (location as any).state || {};
    if (state.email) setEmail(state.email);
  }, [navigate]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !code) {
      toast.error("Please enter your email and the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const response = await verifyOTP({ email, code });
      const token = (response as any).access_token;
      const user = (response as any).user;
      if (token && user) {
        setAuthToken(token);
        login(token, user);
        toast.success(`Welcome to TaskFlow, ${user.name}!`);
        navigate("/");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) return;
    try {
      await resendOTP(email);
      toast.success("A new verification code has been sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend code.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold text-white tracking-tight">
            T<span className="text-purple-400">askflow</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Verify your email</h1>
          <p className="text-sm text-gray-300">A 6-digit code was sent to {email}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-200">Verification code</label>
            <div className="relative">
              <AlertCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all tracking-widest text-center text-lg font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span>Verifying…</span> : <span>Verify code</span>}
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center text-sm text-gray-400">
          Didn't receive a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors disabled:opacity-50"
          >
            Resend code
          </button>
        </p>

        <p className="text-center text-sm text-gray-400">
          Already verified?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}