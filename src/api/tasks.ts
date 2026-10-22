// ============================================================================
// FILE:       frontend/src/api/tasks.ts
// PURPOSE:    Task management API endpoint wrappers (/tasks).
//             Includes task CRUD, subtask toggling, status flip, drag-and-drop
//             reorder, soft-delete undo restoration, and transfer operations.
// HOW IT WORKS: Builds query strings from TaskFilterParams and issues typed apiRequests.
// USED BY / DEPENDS ON: src/api/client.ts, src/hooks/useTasks.ts, task components.
// KEY CONCEPTS: Typed queries, URLSearchParams, optimistic mutation hooks.
// ============================================================================

import { apiDownload, apiRequest } from "@/api/client";
import {
  DuplicateStrategy,
  ImportReport,
  Page,
  Subtask,
  Task,
  TaskCreatePayload,
  TaskFilterParams,
  TaskStats,
  TaskUpdatePayload,
} from "@/types";

/**
 * Fetch paginated tasks based on filter criteria.
 *
 * @param {TaskFilterParams} [params={}] - Filter, sort, and pagination parameters.
 * @returns {Promise<Page<Task>>} Paginated envelope of tasks.
 */
export async function fetchTasks(params: TaskFilterParams = {}): Promise<Page<Task>> {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.tag) query.set("tag", params.tag);
  if (params.overdue !== undefined) query.set("overdue", String(params.overdue));
  if (params.due_today !== undefined) query.set("due_today", String(params.due_today));
  if (params.user_id !== undefined) query.set("user_id", String(params.user_id));
  if (params.sort) query.set("sort", params.sort);
  if (params.order) query.set("order", params.order);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.page_size !== undefined) query.set("page_size", String(params.page_size));

  const queryString = query.toString();
  const endpoint = queryString ? `/tasks?${queryString}` : "/tasks";

  return apiRequest<Page<Task>>(endpoint);
}

/**
 * Fetch single task by ID.
 *
 * @param {number} taskId - Task ID.
 * @returns {Promise<Task>} Task entity.
 */
export async function fetchTaskById(taskId: number): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}`);
}

export async function fetchTaskStats(userId?: number): Promise<TaskStats> {
  const query = userId === undefined ? "" : `?user_id=${userId}`;
  return apiRequest<TaskStats>(`/tasks/stats${query}`);
}

/**
 * Create a new task.
 *
 * @param {TaskCreatePayload} payload - Task creation data.
 * @returns {Promise<Task>} Created task.
 */
export async function createTask(payload: TaskCreatePayload): Promise<Task> {
  return apiRequest<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Partially update a task.
 *
 * @param {number} taskId - ID of task to update.
 * @param {TaskUpdatePayload} payload - Modified fields.
 * @returns {Promise<Task>} Updated task.
 */
export async function updateTask(taskId: number, payload: TaskUpdatePayload): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Soft-delete a task.
 *
 * @param {number} taskId - ID of task to delete.
 * @returns {Promise<void>}
 */
export async function deleteTask(taskId: number): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

/**
 * Restore a soft-deleted task (5-second undo toast).
 *
 * @param {number} taskId - ID of task to restore.
 * @returns {Promise<Task>} Restored task.
 */
export async function restoreTask(taskId: number): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}/restore`, {
    method: "POST",
  });
}

/**
 * Toggle task status between completed and pending.
 *
 * @param {number} taskId - ID of task to toggle.
 * @returns {Promise<Task>} Updated task.
 */
export async function toggleTaskStatus(taskId: number): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}/toggle`, {
    method: "PATCH",
  });
}

/**
 * Reorder tasks by submitting the desired list of ordered IDs.
 *
 * @param {number[]} orderedIds - Task IDs ordered from top to bottom.
 * @returns {Promise<Task[]>} Updated list of tasks with normalized positions.
 */
export async function reorderTasks(orderedIds: number[]): Promise<Task[]> {
  return apiRequest<Task[]>("/tasks/reorder", {
    method: "PATCH",
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

/**
 * Update or toggle a subtask checklist item.
 *
 * @param {number} taskId - Parent task ID.
 * @param {number} subtaskId - Checklist item ID.
 * @param {object} payload - Fields to update (is_done, title).
 * @returns {Promise<Subtask>} Updated checklist item.
 */
export async function updateSubtask(
  taskId: number,
  subtaskId: number,
  payload: { is_done?: boolean; title?: string }
): Promise<Subtask> {
  return apiRequest<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createSubtask(taskId: number, title: string): Promise<Subtask> {
  return apiRequest<Subtask>(`/tasks/${taskId}/subtasks`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function deleteSubtask(taskId: number, subtaskId: number): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
}

export async function exportTasks(format: "csv" | "json", filters: TaskFilterParams = {}): Promise<Blob> {
  const query = new URLSearchParams({ format });
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  if (filters.priority) query.set("priority", filters.priority);
  if (filters.tag) query.set("tag", filters.tag);
  if (filters.overdue !== undefined) query.set("overdue", String(filters.overdue));
  if (filters.due_today !== undefined) query.set("due_today", String(filters.due_today));
  if (filters.user_id !== undefined) query.set("user_id", String(filters.user_id));
  if (filters.sort) query.set("sort", filters.sort);
  if (filters.order) query.set("order", filters.order);
  return apiDownload(`/tasks/export?${query.toString()}`);
}

/**
 * Upload and import tasks from a CSV or JSON file.
 *
 * @param {File} file - Uploaded file object.
 * @param {object} [options={}] - Import options (strategy, dry run, target user).
 * @returns {Promise<ImportReport>} Summary report of the import.
 */
export async function importTasks(
  file: File,
  options: {
    on_duplicate?: DuplicateStrategy;
    dry_run?: boolean;
    target_user_id?: number;
  } = {}
): Promise<ImportReport> {
  const formData = new FormData();
  formData.append("file", file);
  if (options.on_duplicate) formData.append("on_duplicate", options.on_duplicate);
  if (options.dry_run !== undefined) formData.append("dry_run", String(options.dry_run));
  if (options.target_user_id !== undefined) {
    formData.append("target_user_id", String(options.target_user_id));
  }

  return apiRequest<ImportReport>("/tasks/import", {
    method: "POST",
    body: formData,
  });
}
