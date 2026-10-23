// ============================================================================
// FILE:       frontend/src/context/RoleContext.tsx
// PURPOSE:    React Context providing active user identity and role management.
// HOW IT WORKS: Stores currentUserId and currentRole in state and syncs with
//             localStorage. Fetches all users ONLY when authenticated.
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchUsers } from "@/api/users";
import { useAuth } from "@/context/AuthContext";
import { Role, User } from "@/types";

interface RoleContextValue {
  currentUserId: number;
  currentRole: Role;
  currentUser: User | null;
  users: User[];
  isAdmin: boolean;
  setRole: (role: Role) => void;
  setUserId: (userId: number) => void;
  switchUser: (user: User) => void;
  refreshUsers: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // FIX: pull auth state so we can gate the user fetch.
  const { isAuthenticated } = useAuth();

  const [currentUserId, setCurrentUserIdState] = useState<number>(() => {
    const saved = localStorage.getItem("taskflow_user_id");
    return saved ? parseInt(saved, 10) : 1;
  });

  const [currentRole, setCurrentRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem("taskflow_role") as Role;
    return saved === "user" || saved === "admin" ? saved : "admin";
  });

  const [users, setUsers] = useState<User[]>([]);

  const refreshUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      // Ignore failures; caller may retry.
    }
  };

  // FIX: only fetch users when a session exists. This removes the
  // "GET /users 401" noise on the login/register/OTP pages.
  useEffect(() => {
    if (isAuthenticated) {
      refreshUsers();
    } else {
      setUsers([]);
    }
  }, [isAuthenticated]);

  const setUserId = (id: number) => {
    setCurrentUserIdState(id);
    localStorage.setItem("taskflow_user_id", String(id));

    const matchingUser = users.find((u) => u.id === id);
    if (matchingUser) {
      setCurrentRoleState(matchingUser.role);
      localStorage.setItem("taskflow_role", matchingUser.role);
    }
  };

  const setRole = (role: Role) => {
    setCurrentRoleState(role);
    localStorage.setItem("taskflow_role", role);
  };

  const switchUser = (user: User) => {
    setCurrentUserIdState(user.id);
    setCurrentRoleState(user.role);
    localStorage.setItem("taskflow_user_id", String(user.id));
    localStorage.setItem("taskflow_role", user.role);
  };

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const isAdmin = currentRole === "admin";

  return (
    <RoleContext.Provider
      value={{
        currentUserId,
        currentRole,
        currentUser,
        users,
        isAdmin,
        setRole,
        setUserId,
        switchUser,
        refreshUsers,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}