// ============================================================================
// FILE:       frontend/src/context/RoleContext.tsx
// PURPOSE:    React Context providing active user identity and role management.
//             Persists selections to localStorage so browser reloads retain identity.
//             Drives the Header role switcher (User View ⇄ Admin View) and user picker.
// HOW IT WORKS: Stores currentUserId and currentRole in state and syncs with
//             localStorage keys 'taskflow_user_id' and 'taskflow_role'.
//             Fetches all users so dropdowns can list available identities.
// USED BY / DEPENDS ON: src/components/layout/RoleSwitcher.tsx, src/api/client.ts,
//             src/App.tsx.
// KEY CONCEPTS: React Context, localStorage persistence, RBAC frontend simulation.
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchUsers } from "@/api/users";
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

/**
 * Provider component wrapping application with user and role state.
 */
export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial user ID from localStorage, defaulting to 1 (Ada Lovelace / Admin).
  const [currentUserId, setCurrentUserIdState] = useState<number>(() => {
    const saved = localStorage.getItem("taskflow_user_id");
    return saved ? parseInt(saved, 10) : 1;
  });

  // Read initial role from localStorage, defaulting to 'admin'.
  const [currentRole, setCurrentRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem("taskflow_role") as Role;
    return saved === "user" || saved === "admin" ? saved : "admin";
  });

  // Cached list of all users from database.
  const [users, setUsers] = useState<User[]>([]);

  // Function to reload user list.
  const refreshUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      // Ignore initial user fetch failures before backend is reached.
    }
  };

  // Fetch users on initial mount.
  useEffect(() => {
    refreshUsers();
  }, []);

  // Update user ID and synchronize with localStorage.
  const setUserId = (id: number) => {
    setCurrentUserIdState(id);
    localStorage.setItem("taskflow_user_id", String(id));

    // Also update role if matching user is found.
    const matchingUser = users.find((u) => u.id === id);
    if (matchingUser) {
      setCurrentRoleState(matchingUser.role);
      localStorage.setItem("taskflow_role", matchingUser.role);
    }
  };

  // Update role and synchronize with localStorage.
  const setRole = (role: Role) => {
    setCurrentRoleState(role);
    localStorage.setItem("taskflow_role", role);
  };

  // Switch to specific user account directly.
  const switchUser = (user: User) => {
    setCurrentUserIdState(user.id);
    setCurrentRoleState(user.role);
    localStorage.setItem("taskflow_user_id", String(user.id));
    localStorage.setItem("taskflow_role", user.role);
  };

  // Active user entity derived from users array.
  const currentUser = users.find((u) => u.id === currentUserId) || null;

  // Convenient boolean helper.
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

/**
 * Hook to consume active RoleContext.
 *
 * @returns {RoleContextValue} Active identity and role methods.
 */
export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
