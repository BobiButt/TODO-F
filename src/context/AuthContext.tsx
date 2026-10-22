// ============================================================================
// FILE:       frontend/src/context/AuthContext.tsx
// PURPOSE:    React Context for JWT authentication state.
//             Manages access token, current user, login/logout, and persistence
//             to localStorage so sessions survive page reloads.
// HOW IT WORKS: Stores the JWT token and user profile in state. On mount,
//             restores them from localStorage ('taskflow_token', 'taskflow_user').
//             Provides login(), logout(), and setToken() mutations.
// USED BY / DEPENDS ON: src/api/client.ts (reads token), src/pages/* (login UI),
//             src/App.tsx (route protection).
// KEY CONCEPTS: JWT Bearer token, localStorage persistence, session restore,
//             protected route gating.
// ============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { User } from "@/types";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "taskflow_token";
const USER_KEY = "taskflow_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount.
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        setTokenState(savedToken);
        setUserState(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (tokenValue: string, userValue: User) => {
    localStorage.setItem(TOKEN_KEY, tokenValue);
    localStorage.setItem(USER_KEY, JSON.stringify(userValue));
    setTokenState(tokenValue);
    setUserState(userValue);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUserState(null);
  };

  const setToken = (tokenValue: string | null) => {
    if (tokenValue) {
      localStorage.setItem(TOKEN_KEY, tokenValue);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(tokenValue);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
