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
  // Read from Vite env — must start with VITE_ to be exposed to the browser bundle
  const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientId = rawClientId ? rawClientId.trim() : undefined;
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Use a ref for the callback to avoid stale closures in Google's script
  const callbackRef = useRef<(response: { credential: string }) => void>(() => {});

  // Per-instance flag: resets on Strict Mode unmount/remount so initialize()
  // is called once per mount, bound to the correct DOM element.
  const isInitialized = useRef(false);

  // Update the callback ref on every render
  useEffect(() => {
    callbackRef.current = async (response) => {
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
  });

  // Poll for the Google script to load
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
    if (!ready || !ref.current) return;
    if (!window.google?.accounts?.id) return;

    if (!clientId) {
      // Cannot initialize GSI without a client ID — fall back to the custom prompt button
      return;
    }

    // Log the exact clientId string before initializing (checks for hidden spaces / undefined)
    console.log("Google Client ID:", JSON.stringify(clientId));

    // Initialize once per mount (useRef resets on Strict Mode remount).
    // Safe to call initialize() again on remount because the ref is fresh.
    if (!isInitialized.current) {
      isInitialized.current = true;
      window.google.accounts.id.initialize({
        clientId,
        callback: (res: any) => callbackRef.current(res),
      });
    }

    // Render the native GSI button
    // width omitted so the button fills its container (responsive).
    // The parent div already has w-full from the className passed in AuthPages.
    window.google.accounts.id.renderButton(ref.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
    });
  }, [ready, clientId]);

  // Fallback: custom HTML button that triggers Google One Tap prompt when clientId is missing
  const gsi = window.google?.accounts?.id;
  if (!clientId && ready && gsi) {
    return (
      <button
        type="button"
        onClick={() => {
          gsi.prompt();
        }}
        className={`w-full flex items-center justify-center gap-3 bg-white/5 border border-white/20 text-white font-medium py-2.5 rounded-lg hover:bg-white/10 transition-colors ${className ?? ""}`}
      >
        Sign in with Google
      </button>
    );
  }

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