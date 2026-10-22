// ============================================================================
// FILE:       frontend/src/api/admin.ts
// PURPOSE:    Administrator panel API endpoint calls (/admin/*).
//             Includes KPI metrics dashboard, audit logs, comment moderation,
//             bulk task actions, and task reassignment.
// HOW IT WORKS: Issues HTTP calls guarded by admin role headers.
// USED BY / DEPENDS ON: src/api/client.ts, src/hooks/useAdmin.ts, Admin pages.
// KEY CONCEPTS: Admin endpoints, bulk mutations, audit queries.
// ============================================================================

import { apiRequest } from "@/api/client";
import {
  ActivityLog,
  AdminStats,
  CommentModerationItem,
  Page,
} from "@/types";

/**
 * Fetch system KPI metrics and per-user statistics for admin dashboard.
 *
 * @returns {Promise<AdminStats>} Aggregated statistics.
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  return apiRequest<AdminStats>("/admin/stats");
}

/**
 * Fetch paginated audit activity log records.
 *
 * @param {number} [page=1] - 1-based page number.
 * @param {number} [pageSize=20] - Number of items per page.
 * @param {string} [action] - Optional action verb filter.
 * @param {string} [entityType] - Optional resource kind filter.
 * @returns {Promise<Page<ActivityLog>>} Paginated activity log entries.
 */
export async function fetchActivityLog(
  page: number = 1,
  pageSize: number = 20,
  action?: string,
  entityType?: string
): Promise<Page<ActivityLog>> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (action) query.set("action", action);
  if (entityType) query.set("entity_type", entityType);

  return apiRequest<Page<ActivityLog>>(`/admin/activity?${query.toString()}`);
}

/**
 * Fetch recent comments across all tasks for moderation.
 *
 * @param {number} [limit=50] - Maximum records to fetch.
 * @returns {Promise<CommentModerationItem[]>} Comments with task and author details.
 */
export async function fetchModerationComments(
  limit: number = 50
): Promise<CommentModerationItem[]> {
  return apiRequest<CommentModerationItem[]>(`/admin/comments?limit=${limit}`);
}

/**
 * Bulk complete multiple tasks at once.
 *
 * @param {number[]} taskIds - List of task IDs.
 * @returns {Promise<{ message: string; count: number }>}
 */
export async function bulkCompleteTasks(
  taskIds: number[]
): Promise<{ message: string; count: number }> {
  return apiRequest<{ message: string; count: number }>("/admin/tasks/bulk-complete", {
    method: "POST",
    body: JSON.stringify({ task_ids: taskIds }),
  });
}

/**
 * Bulk soft-delete multiple tasks at once.
 *
 * @param {number[]} taskIds - List of task IDs.
 * @returns {Promise<{ message: string; count: number }>}
 */
export async function bulkDeleteTasks(
  taskIds: number[]
): Promise<{ message: string; count: number }> {
  return apiRequest<{ message: string; count: number }>("/admin/tasks/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ task_ids: taskIds }),
  });
}

/**
 * Reassign a task to a different owner user.
 *
 * @param {number} taskId - Task ID to reassign.
 * @param {number} newUserId - Destination user ID.
 * @returns {Promise<{ message: string; task_id: number; new_user_id: number }>}
 */
export async function reassignTask(
  taskId: number,
  newUserId: number
): Promise<{ message: string; task_id: number; new_user_id: number }> {
  return apiRequest<{ message: string; task_id: number; new_user_id: number }>(
    `/admin/tasks/${taskId}/reassign`,
    {
      method: "PATCH",
      body: JSON.stringify({ user_id: newUserId }),
    }
  );
}
