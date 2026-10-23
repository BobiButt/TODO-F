// ============================================================================
// FILE:       frontend/src/components/GoogleSignInButton.tsx
// PURPOSE:    Renders the official Google "Sign in with Google" button.
// FIXES:      * uses VITE_GOOGLE_CLIENT_ID (Vite only exposes VITE_* vars)
//             * numeric width (Google rejects "100%")
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleSignIn } from "@/api/auth";
import { setAuthToken } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface GoogleSignInButtonProps {
  className?: string;
}

export function GoogleSignInButton({ className }: GoogleSignInButtonProps = {}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  // FIX: Vite requires the VITE_ prefix to expose env vars to the client.
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        setReady(true);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready || !clientId || initialized.current || !ref.current) return;
    if (!window.google?.accounts?.id) return;
    initialized.current = true;

    window.google.accounts.id.initialize({
      clientId,
      callback: handleCredentialResponse,
    });

    window.google.accounts.id.renderButton(ref.current, {
      theme: "outline",
      size: "large",
      // FIX: Google's API rejects "100%"; it needs a pixel number.
      width: 320,
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
    });
  }, [ready, clientId]);

  const handleCredentialResponse = async (response: { credential: string }) => {
    try {
      const data = await googleSignIn({ credential: response.credential });
      const token = (data as any).access_token;
      const user = (data as any).user;
      if (token && user) {
        setAuthToken(token);
        login(token, user);
        toast.success(`Welcome back, ${user.name}!`);
        navigate("/");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  };

  if (!clientId) {
    return (
      <button
        disabled
        className={`w-full flex items-center justify-center gap-3 bg-white/5 border border-white/20 text-white font-medium py-2.5 rounded-lg ${className ?? ""}`}
      >
        Google Sign-In not configured
      </button>
    );
  }

  return <div ref={ref} className={className ?? ""} />;
}