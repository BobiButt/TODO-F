// ============================================================================
// FILE:       frontend/src/hooks/useUsers.ts
// PURPOSE:    TanStack Query hooks for fetching and mutating users.
// HOW IT WORKS: Wraps fetchUsers, createUser, updateUser, deleteUser with
//             automatic cache invalidation and error toast alerts.
// USED BY / DEPENDS ON: src/api/users.ts, src/components/admin/UsersTable.tsx.
// KEY CONCEPTS: React Query queries & mutations, cache keys, invalidation.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteUser, fetchUsers, updateUser } from "@/api/users";
import { Role, User } from "@/types";
import { toast } from "sonner";

/** Query key for all users. */
export const USERS_QUERY_KEY = ["users"];

/**
 * Hook to retrieve all registered users.
 */
export function useUsers() {
  return useQuery<User[]>({
    queryKey: USERS_QUERY_KEY,
    queryFn: fetchUsers,
  });
}

/**
 * Hook to create a new user.
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; email: string; role: Role }) =>
      createUser(payload),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success(`User "${newUser.name}" created successfully.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create user.");
    },
  });
}

/**
 * Hook to update a user.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number;
      payload: { name?: string; email?: string; role?: Role };
    }) => updateUser(userId, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      toast.success(`User "${updated.name}" updated.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update user.");
    },
  });
}

/**
 * Hook to delete a user.
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("User deleted successfully.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete user.");
    },
  });
}
