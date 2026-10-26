import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleSignIn } from "@/api/auth";
import { setAuthToken } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface GoogleSignInButtonProps {
  className?: string;
}

export function GoogleSignInButton({ className = "" }: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Read from Vite env and clean up any potential quotes or whitespace
  const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientId = rawClientId ? rawClientId.trim().replace(/^["']|["']$/g, "") : undefined;

  const ref = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isInitialized = useRef(false);

  // Store callback in a ref to avoid stale closures inside the Google SDK callback
  const callbackRef = useRef<(response: { credential: string }) => void>(() => {});

  useEffect(() => {
    callbackRef.current = async (response) => {
      if (!response?.credential) {
        toast.error("No credential received from Google.");
        return;
      }
      setIsSubmitting(true);
      try {
        const data = await googleSignIn({ credential: response.credential });
        const token = (data as any)?.access_token;
        const user = (data as any)?.user;
        if (token && user) {
          setAuthToken(token);
          login(token, user);
          toast.success(`Welcome back, ${user.name}!`);
          navigate("/tasks");
        } else {
          toast.error("Failed to obtain authentication token from server.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Google sign-in failed.");
      } finally {
        setIsSubmitting(false);
      }
    };
  });

  // Poll for the Google Identity Services script to finish loading
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptReady(true);
      return;
    }

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        setScriptReady(true);
        clearInterval(timer);
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(timer);
    }, 10000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, []);

  // Initialize Google Identity Services
  // IMPORTANT: GIS expects `client_id` (snake_case). Passing `clientId` caused the 403 / 400 invalid_request error!
  useEffect(() => {
    if (!scriptReady || !clientId || !window.google?.accounts?.id) return;

    if (!isInitialized.current) {
      isInitialized.current = true;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId, // Crucial parameter
          clientId: clientId,  // Provided as alias for safety
          callback: (res: any) => callbackRef.current(res),
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
        });
        setInitialized(true);
      } catch (err) {
        console.error("Google accounts.id.initialize error:", err);
      }
    }
  }, [scriptReady, clientId]);

  // Render the Google GSI button into the ref element
  useEffect(() => {
    if (!initialized || !ref.current || !window.google?.accounts?.id) return;

    try {
      ref.current.innerHTML = "";
      window.google.accounts.id.renderButton(ref.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 320,
      });
    } catch (err) {
      console.error("Google accounts.id.renderButton error:", err);
    }
  }, [initialized]);

  // Fallback / One-Tap trigger if custom button is clicked
  const handleCustomClick = () => {
    if (!clientId) {
      toast.error("Google Client ID is not configured. Please check your environment variables.");
      return;
    }
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch {
        toast.info("Opening Google Sign-In prompt...");
      }
    } else {
      toast.error("Google Sign-In script is still loading. Please wait a moment.");
    }
  };

  if (!clientId) {
    return (
      <div className={`w-full flex justify-center ${className}`}>
        <button
          type="button"
          disabled
          className="w-full max-w-xs flex items-center justify-center gap-3 bg-white/5 border border-white/20 text-gray-400 font-medium py-2.5 px-4 rounded-lg cursor-not-allowed text-sm"
        >
          Google Sign-In not configured
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      {/* Target container for Google's native iframe button */}
      <div
        ref={ref}
        className={`min-h-[44px] flex items-center justify-center transition-opacity duration-200 ${
          initialized ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
        }`}
      />

      {/* Sleek placeholder / fallback button shown while initializing or if iframe takes time */}
      {!initialized && (
        <button
          type="button"
          onClick={handleCustomClick}
          disabled={isSubmitting}
          className="w-full max-w-xs flex items-center justify-center gap-3 bg-white/5 border border-white/20 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-white/10 active:scale-[0.99] transition-all text-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{scriptReady ? "Sign in with Google" : "Loading Google Sign-In…"}</span>
        </button>
      )}

      {isSubmitting && (
        <p className="text-xs text-purple-400 mt-2 animate-pulse">Authenticating with Google…</p>
      )}
    </div>
  );
}