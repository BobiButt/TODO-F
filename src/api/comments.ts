// ============================================================================
// FILE:       frontend/src/api/comments.ts
// PURPOSE:    Comment thread API endpoint wrappers (/tasks/{task_id}/comments).
// HOW IT WORKS: Issues HTTP calls to fetch, post, edit, and delete comments.
// USED BY / DEPENDS ON: src/api/client.ts, src/hooks/useComments.ts, CommentThread.
// KEY CONCEPTS: Discussion thread endpoints, author edits, moderation delete.
// ============================================================================

import { apiRequest } from "@/api/client";
import { Comment } from "@/types";

/**
 * Fetch all comments for a given task thread in chronological order.
 *
 * @param {number} taskId - Parent task ID.
 * @returns {Promise<Comment[]>} List of comments ordered oldest to newest.
 */
export async function fetchComments(taskId: number): Promise<Comment[]> {
  return apiRequest<Comment[]>(`/tasks/${taskId}/comments`);
}

/**
 * Post a new comment on a task thread.
 *
 * @param {number} taskId - Parent task ID.
 * @param {string} body - Comment text (1-1000 characters).
 * @returns {Promise<Comment>} Created comment entity.
 */
export async function createComment(taskId: number, body: string): Promise<Comment> {
  return apiRequest<Comment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

/**
 * Edit an existing comment.
 *
 * @param {number} taskId - Parent task ID.
 * @param {number} commentId - Comment ID to update.
 * @param {string} body - Updated comment text.
 * @returns {Promise<Comment>} Updated comment entity.
 */
export async function updateComment(
  taskId: number,
  commentId: number,
  body: string
): Promise<Comment> {
  return apiRequest<Comment>(`/tasks/${taskId}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

/**
 * Delete a comment from a task thread.
 *
 * @param {number} taskId - Parent task ID.
 * @param {number} commentId - Comment ID to delete.
 * @returns {Promise<void>}
 */
export async function deleteComment(taskId: number, commentId: number): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/comments/${commentId}`, {
    method: "DELETE",
  });
}
