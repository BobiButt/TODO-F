// ============================================================================
// FILE:       frontend/src/api/users.ts
// PURPOSE:    User management API endpoint calls (/users).
// HOW IT WORKS: Wraps apiRequest to fetch, create, update, and delete users.
// USED BY / DEPENDS ON: src/api/client.ts, src/hooks/useUsers.ts, AdminUsers page.
// KEY CONCEPTS: REST client, typed promises, role parameters.
// ============================================================================

import { apiRequest } from "@/api/client";
import { Role, User } from "@/types";

/**
 * Fetch all registered users.
 *
 * @returns {Promise<User[]>} Array of user accounts.
 */
export async function fetchUsers(): Promise<User[]> {
  return apiRequest<User[]>("/users");
}

/**
 * Fetch single user by ID.
 *
 * @param {number} userId - Target user ID.
 * @returns {Promise<User>} User entity.
 */
export async function fetchUserById(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}`);
}

/**
 * Create a new user (Admin only).
 *
 * @param {object} payload - User creation data.
 * @returns {Promise<User>} Created user entity.
 */
export async function createUser(payload: {
  name: string;
  email: string;
  role: Role;
}): Promise<User> {
  return apiRequest<User>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing user.
 *
 * @param {number} userId - ID of user to update.
 * @param {object} payload - Updated user fields.
 * @returns {Promise<User>} Updated user entity.
 */
export async function updateUser(
  userId: number,
  payload: { name?: string; email?: string; role?: Role }
): Promise<User> {
  return apiRequest<User>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a user and cascade to their tasks/comments (Admin only).
 *
 * @param {number} userId - ID of user to delete.
 * @returns {Promise<void>}
 */
export async function deleteUser(userId: number): Promise<void> {
  return apiRequest<void>(`/users/${userId}`, {
    method: "DELETE",
  });
}
