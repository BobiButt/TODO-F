// ============================================================================
// FILE:       frontend/src/types/index.ts
// PURPOSE:    Shared TypeScript interfaces and types for the TaskFlow frontend.
//             Mirrors the backend Pydantic data schemas exactly to ensure type safety.
// HOW IT WORKS: Exported types are consumed by API client, React context, hooks,
//             and UI components.
// USED BY / DEPENDS ON: src/api/*, src/hooks/*, src/components/*, src/context/*.
// KEY CONCEPTS: Type contracts, domain modeling, API response shapes.
// ============================================================================

/** Role permission levels supported by the role switcher. */
export type Role = "admin" | "user";

/** Task urgency levels. */
export type Priority = "low" | "medium" | "high";

/** Workflow states of a task. */
export type Status = "pending" | "in_progress" | "completed";

/** User model contract. */
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

/** Checklist subtask item. */
export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

/** Comment on a task. */
export interface Comment {
  id: number;
  task_id: number;
  user_id: number;
  author_name: string | null;
  body: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

/** Task item with checklist subtasks and comment counter. */
export interface Task {
  id: number;
  user_id: number;
  owner_name: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  due_date: string | null;
  tags: string[];
  category: string | null;
  position: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
  comments_count: number;
}

/** Generic pagination envelope matching backend Page[T]. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

/** Task filter parameters. */
export interface TaskFilterParams {
  q?: string;
  status?: Status;
  priority?: Priority;
  tag?: string;
  overdue?: boolean;
  due_today?: boolean;
  user_id?: number;
  sort?: "position" | "due_date" | "priority" | "created";
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

/** Task creation payload. */
export interface TaskCreatePayload {
  title: string;
  description?: string | null;
  priority?: Priority;
  status?: Status;
  due_date?: string | null;
  tags?: string[];
  category?: string | null;
  position?: number;
  subtasks?: { title: string; is_done?: boolean }[];
}

/** Task partial update payload. */
export interface TaskUpdatePayload {
  title?: string;
  description?: string | null;
  priority?: Priority;
  status?: Status;
  due_date?: string | null;
  tags?: string[];
  category?: string | null;
  position?: number;
}

/** Breakdown of tasks per user for admin stats. */
export interface UserTaskStat {
  user_id: number;
  user_name: string;
  task_count: number;
  completed_count: number;
}

/** Admin KPI metrics summary. */
export interface AdminStats {
  total_users: number;
  total_tasks: number;
  completion_rate: number;
  overdue_tasks: number;
  total_comments: number;
  tasks_per_user: UserTaskStat[];
}

/** Audit activity log entry. */
export interface ActivityLog {
  id: number;
  user_id: number | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  detail: Record<string, any>;
  created_at: string;
}

/** Moderation comment overview. */
export interface CommentModerationItem {
  id: number;
  task_id: number;
  task_title: string;
  user_id: number;
  author_name: string;
  body: string;
  created_at: string;
}

/** Duplicate strategy options for import. */
export type DuplicateStrategy = "skip" | "overwrite" | "create";

/** Individual row failure during import. */
export interface ImportRowError {
  row_number: number;
  title: string | null;
  reason: string;
}

/** Import result report. */
export interface ImportReport {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_rows: number;
  skipped_rows: number;
  overwritten_rows: number;
  dry_run: boolean;
  errors: ImportRowError[];
  message: string;
}
