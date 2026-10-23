// ============================================================================
// FILE:       frontend/src/components/GoogleSignInButton.tsx
// PURPOSE:    Renders the official Google "Sign in with Google" button using
//             Google Identity Services and exchanges the returned ID token for a
//             TaskFlow JWT via the /auth/google endpoint.
// HOW IT WORKS: Waits for the gsi/client script (loaded in index.html) to expose
//             `window.google.accounts.id`, initializes it with the configured
//             client ID, renders the native Google button, and on credential
//             response calls `googleSignIn` then restores the session.
// USED BY / DEPENDS ON: src/pages/AuthPages.tsx (Login & Register).
// NOTE:       Set VITE_GOOGLE_CLIENT_ID and add your origins to Google Cloud
//             Console (https://todo-app-six-phi-88.vercel.app, http://localhost:5173).
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

/**
 * Official Google Sign-In button. Requires VITE_GOOGLE_CLIENT_ID.
 */
export function GoogleSignInButton({ className }: GoogleSignInButtonProps = {}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  // Poll until Google Identity Services exposes `window.google.accounts.id`.
  useEffect(() => {
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        setReady(true);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Initialize GIS once and render the native Google button into the ref element.
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
      width: "100%",
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
