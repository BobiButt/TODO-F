import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleSignIn } from "@/api/auth";
import { setAuthToken } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface GoogleSignInButtonProps {
  className?: string;
}

// Global flag to prevent React Strict Mode double-initialization
let isGoogleInitialized = false;

export function GoogleSignInButton({ className }: GoogleSignInButtonProps = {}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // 🚨 HARDCODED FOR TESTING
  const clientId = "292952689335-b7310ecg1r9emo0qh0559a4a0s5ecjlu.apps.googleusercontent.com";
  
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const callbackRef = useRef<(response: { credential: string }) => void>(() => {});

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
    if (!ready || !clientId || !ref.current) return;
    if (!window.google?.accounts?.id) return;

    if (!isGoogleInitialized) {
      isGoogleInitialized = true;
      console.log("🚨 INITIALIZING GOOGLE WITH CLIENT ID:", clientId);
      
      window.google.accounts.id.initialize({
        clientId,
        callback: (res: any) => callbackRef.current(res),
      });
    }

    window.google.accounts.id.renderButton(ref.current, {
      theme: "outline",
      size: "large",
      width: "100%", // Kept your preference
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
    });
  }, [ready, clientId]);

  return <div ref={ref} className={className ?? ""} />;
}