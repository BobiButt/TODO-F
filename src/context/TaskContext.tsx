// ============================================================================
// FILE:       frontend/src/context/TaskContext.tsx
// PURPOSE:    Centralized High-Performance Task Cache and State Management.
//             Holds loaded tasks in-memory and sessionStorage to eliminate slow DB load.
// HOW IT WORKS:
//   1. On first load, reads from user-scoped sessionStorage cache if present (0ms load).
//   2. If cache is empty, fetches once from DB and holds until tasks are created/edited/deleted.
//   3. On create, edit, delete, toggle, or reorder (by user or assistant):
//      - Optimistically updates cache in-place immediately.
//      - In the meantime, always displays loaded tasks without blank loading spinners.
//      - Quietly syncs with backend and keeps cache in sync.
//   4. Supports instant client-side filtering/sorting without DB round trips.
// ============================================================================

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createSubtask as apiCreateSubtask,
  createTask as apiCreateTask,
  deleteSubtask as apiDeleteSubtask,
  deleteTask as apiDeleteTask,
  fetchTaskStats as apiFetchTaskStats,
  fetchTasks as apiFetchTasks,
  reorderTasks as apiReorderTasks,
  restoreTask as apiRestoreTask,
  toggleTaskStatus as apiToggleTaskStatus,
  updateSubtask as apiUpdateSubtask,
  updateTask as apiUpdateTask,
} from "@/api/tasks";
import { useAuth } from "@/context/AuthContext";
import {
  Status,
  Subtask,
  Task,
  TaskCreatePayload,
  TaskFilterParams,
  TaskStats,
  TaskUpdatePayload,
} from "@/types";

interface TaskContextValue {
  // Data
  tasks: Task[];
  filteredTasks: Task[];
  stats: TaskStats | null;
  total: number;
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;

  // Filter & Search State
  filterParams: TaskFilterParams;
  setFilterParams: React.Dispatch<React.SetStateAction<TaskFilterParams>>;
  resetFilters: () => void;

  // Task Mutations (Optimistic + Cache Update)
  createTask: (payload: TaskCreatePayload, ownerName?: string) => Promise<Task>;
  updateTask: (taskId: number, payload: TaskUpdatePayload) => Promise<Task>;
  deleteTask: (taskId: number) => Promise<void>;
  restoreTask: (taskId: number) => Promise<Task>;
  toggleTaskStatus: (taskId: number, completed: boolean) => Promise<Task>;
  reorderTasks: (orderedIds: number[]) => Promise<Task[]>;

  // Subtask & Comment Cache Helpers
  createSubtask: (taskId: number, title: string) => Promise<Subtask>;
  updateSubtask: (taskId: number, subtaskId: number, payload: { is_done?: boolean; title?: string }) => Promise<Subtask>;
  deleteSubtask: (taskId: number, subtaskId: number) => Promise<void>;
  incrementCommentCount: (taskId: number, delta?: number) => void;

  // Cache & Assistant Sync
  refreshFromDB: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;
  notifyAssistantAction: (actions?: { name: string; ok: boolean }[]) => void;
  clearCache: () => void;
}

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

const initialFilters: TaskFilterParams = {
  q: "",
  status: undefined,
  priority: undefined,
  tag: "",
  overdue: false,
  due_today: false,
  sort: "position",
  order: "asc",
  page: 1,
  page_size: 50,
};

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id;

  // Cache storage key scoped by user
  const CACHE_KEY = userId ? `taskflow_cached_tasks_${userId}` : null;
  const STATS_KEY = userId ? `taskflow_cached_stats_${userId}` : null;
  const SYNC_KEY = userId ? `taskflow_cached_sync_${userId}` : null;

  // In-memory tasks & stats
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (!CACHE_KEY) return [];
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState<TaskStats | null>(() => {
    if (!STATS_KEY) return null;
    try {
      const raw = sessionStorage.getItem(STATS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [lastSynced, setLastSynced] = useState<Date | null>(() => {
    if (!SYNC_KEY) return null;
    const raw = sessionStorage.getItem(SYNC_KEY);
    return raw ? new Date(raw) : null;
  });

  // Only show full loading spinner if cache is completely empty
  const [isLoading, setIsLoading] = useState<boolean>(() => tasks.length === 0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [filterParams, setFilterParams] = useState<TaskFilterParams>(initialFilters);

  // Sync ref to prevent concurrent background fetches
  const isFetchingRef = useRef(false);

  // Persist tasks & stats to sessionStorage whenever they change
  useEffect(() => {
    if (!CACHE_KEY) return;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn("Could not cache tasks in sessionStorage:", e);
    }
  }, [CACHE_KEY, tasks]);

  useEffect(() => {
    if (!STATS_KEY || !stats) return;
    try {
      sessionStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn("Could not cache stats in sessionStorage:", e);
    }
  }, [STATS_KEY, stats]);

  // Derive stats dynamically from cached tasks for instant updates
  const computedStats = useMemo<TaskStats>(() => {
    if (stats && tasks.length === 0) return stats;
    const total = tasks.length;
    let pending = 0;
    let in_progress = 0;
    let completed = 0;
    let overdue = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const t of tasks) {
      if (t.status === "completed") completed++;
      else if (t.status === "in_progress") in_progress++;
      else pending++;

      if (t.status !== "completed" && t.due_date && t.due_date < today) {
        overdue++;
      }
    }

    return { total, pending, in_progress, completed, overdue };
  }, [tasks, stats]);

  // Core function to fetch fresh data from DB
  const refreshFromDB = async (options: { silent?: boolean; force?: boolean } = {}) => {
    if (!isAuthenticated || isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!options.silent && tasks.length === 0) {
      setIsLoading(true);
    }
    setIsSyncing(true);

    try {
      const [taskPage, newStats] = await Promise.all([
        apiFetchTasks({ page: 1, page_size: 100, sort: "position", order: "asc" }),
        apiFetchTaskStats(user?.role === "admin" ? undefined : userId),
      ]);

      setTasks(taskPage.items);
      setStats(newStats);
      const now = new Date();
      setLastSynced(now);
      if (SYNC_KEY) {
        sessionStorage.setItem(SYNC_KEY, now.toISOString());
      }
    } catch (error) {
      console.warn("Failed to fetch fresh tasks from DB:", error);
      if (options.force) {
        toast.error(error instanceof Error ? error.message : "Failed to sync tasks from database.");
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
      isFetchingRef.current = false;
    }
  };

  // Initial load: if cache exists, use it immediately! Otherwise fetch once from DB.
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    if (tasks.length === 0) {
      // No cached data: fetch from DB
      refreshFromDB();
    } else {
      // Cached data exists! Mark loading false immediately.
      setIsLoading(false);
      // Quietly sync in the background if last sync was over 10 minutes ago
      const tenMinutes = 10 * 60 * 1000;
      if (!lastSynced || Date.now() - lastSynced.getTime() > tenMinutes) {
        refreshFromDB({ silent: true });
      }
    }
  }, [isAuthenticated, userId]);

  // Assistant action detector: triggers background sync when assistant creates/updates tasks
  const notifyAssistantAction = (actions?: { name: string; ok: boolean }[]) => {
    const hasTaskAction = actions?.some((a) =>
      a.ok && (a.name.includes("task") || a.name.includes("todo") || a.name.includes("create") || a.name.includes("update") || a.name.includes("delete"))
    );
    // If assistant performed task mutations, refresh cache from DB silently
    if (hasTaskAction || !actions || actions.length === 0) {
      refreshFromDB({ silent: true });
    }
  };

  // Fast Client-Side Filtering & Sorting (0ms latency, zero load on DB)
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    const today = new Date().toISOString().split("T")[0];

    // Search query
    if (filterParams.q?.trim()) {
      const q = filterParams.q.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filterParams.status) {
      result = result.filter((t) => t.status === filterParams.status);
    }

    // Priority filter
    if (filterParams.priority) {
      result = result.filter((t) => t.priority === filterParams.priority);
    }

    // Tag filter
    if (filterParams.tag?.trim()) {
      const tagLower = filterParams.tag.toLowerCase().trim();
      result = result.filter((t) => t.tags.some((tg) => tg.toLowerCase().includes(tagLower)));
    }

    // Owner filter (for admin)
    if (filterParams.user_id !== undefined) {
      result = result.filter((t) => t.user_id === filterParams.user_id);
    }

    // Overdue filter
    if (filterParams.overdue) {
      result = result.filter((t) => t.status !== "completed" && t.due_date && t.due_date < today);
    }

    // Due today filter
    if (filterParams.due_today) {
      result = result.filter((t) => t.due_date === today);
    }

    // Sorting
    const sortField = filterParams.sort || "position";
    const isDesc = filterParams.order === "desc";

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "position") {
        cmp = a.position - b.position;
      } else if (sortField === "due_date") {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        cmp = a.due_date.localeCompare(b.due_date);
      } else if (sortField === "priority") {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        cmp = priorityWeight[b.priority] - priorityWeight[a.priority];
      } else if (sortField === "created") {
        cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return isDesc ? -cmp : cmp;
    });

    return result;
  }, [tasks, filterParams]);

  // Reset filters helper
  const resetFilters = () => {
    setFilterParams(initialFilters);
  };

  // --- Optimistic Mutations ---

  // 1. Create Task
  const createTask = async (payload: TaskCreatePayload, ownerName = "You"): Promise<Task> => {
    const tempId = -Date.now();
    const optimisticTask: Task = {
      id: tempId,
      user_id: userId || 1,
      owner_name: ownerName,
      title: payload.title,
      description: payload.description ?? null,
      priority: payload.priority ?? "medium",
      status: "pending",
      due_date: payload.due_date ?? null,
      tags: payload.tags ?? [],
      category: payload.category ?? null,
      position: 0,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subtasks: [],
      comments_count: 0,
    };

    // Immediately insert into cache
    setTasks((current) => [optimisticTask, ...current]);

    try {
      const realTask = await apiCreateTask(payload);
      // Replace optimistic record with server record
      setTasks((current) => current.map((t) => (t.id === tempId ? realTask : t)));
      return realTask;
    } catch (error) {
      // Rollback on failure
      setTasks((current) => current.filter((t) => t.id !== tempId));
      throw error;
    }
  };

  // 2. Update Task
  const updateTask = async (taskId: number, payload: TaskUpdatePayload): Promise<Task> => {
    const previous = tasks.find((t) => t.id === taskId);
    if (!previous) throw new Error("Task not found in cache");

    // Optimistically update in cache
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? {
              ...t,
              title: payload.title !== undefined ? payload.title : t.title,
              description: payload.description !== undefined ? payload.description : t.description,
              priority: payload.priority !== undefined ? payload.priority : t.priority,
              status: payload.status !== undefined ? payload.status : t.status,
              due_date: payload.due_date !== undefined ? payload.due_date : t.due_date,
              tags: payload.tags !== undefined ? payload.tags : t.tags,
              category: payload.category !== undefined ? payload.category : t.category,
              updated_at: new Date().toISOString(),
            }
          : t
      )
    );

    try {
      const updated = await apiUpdateTask(taskId, payload);
      // Update with exact server payload
      setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    } catch (error) {
      // Rollback on failure
      setTasks((current) => current.map((t) => (t.id === taskId ? previous : t)));
      throw error;
    }
  };

  // 3. Delete Task
  const deleteTask = async (taskId: number): Promise<void> => {
    const previous = tasks.find((t) => t.id === taskId);
    if (!previous) return;

    // Optimistically remove from cache
    setTasks((current) => current.filter((t) => t.id !== taskId));

    try {
      await apiDeleteTask(taskId);
    } catch (error) {
      // Rollback on failure
      setTasks((current) => [previous, ...current]);
      throw error;
    }
  };

  // 4. Restore Task (Undo)
  const restoreTask = async (taskId: number): Promise<Task> => {
    try {
      const restored = await apiRestoreTask(taskId);
      setTasks((current) => [restored, ...current]);
      return restored;
    } catch (error) {
      throw error;
    }
  };

  // 5. Toggle Task Status
  const toggleTaskStatus = async (taskId: number, completed: boolean): Promise<Task> => {
    const previous = tasks.find((t) => t.id === taskId);
    if (!previous) throw new Error("Task not found");

    const desiredStatus: Status = completed ? "completed" : "pending";

    // Optimistically toggle status
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? { ...t, status: desiredStatus, updated_at: new Date().toISOString() }
          : t
      )
    );

    try {
      const updated = await apiToggleTaskStatus(taskId, completed);
      setTasks((current) => current.map((t) => (t.id === taskId ? updated : t)));
      return updated;
    } catch (error) {
      // Rollback
      setTasks((current) => current.map((t) => (t.id === taskId ? previous : t)));
      throw error;
    }
  };

  // 6. Reorder Tasks
  const reorderTasks = async (orderedIds: number[]): Promise<Task[]> => {
    const previous = [...tasks];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const reordered: Task[] = [];

    orderedIds.forEach((id, index) => {
      const t = taskMap.get(id);
      if (t) {
        reordered.push({ ...t, position: index });
      }
    });

    // Also include any tasks not in orderedIds at the end
    tasks.forEach((t) => {
      if (!orderedIds.includes(t.id)) reordered.push(t);
    });

    setTasks(reordered);

    try {
      const result = await apiReorderTasks(orderedIds);
      return result;
    } catch (error) {
      setTasks(previous);
      throw error;
    }
  };

  // 7. Subtask cache helpers
  const createSubtask = async (taskId: number, title: string): Promise<Subtask> => {
    const subtask = await apiCreateSubtask(taskId, title);
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t
      )
    );
    return subtask;
  };

  const updateSubtask = async (
    taskId: number,
    subtaskId: number,
    payload: { is_done?: boolean; title?: string }
  ): Promise<Subtask> => {
    // Optimistic subtask update
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((st) =>
                st.id === subtaskId ? { ...st, ...payload } : st
              ),
            }
          : t
      )
    );

    try {
      const updated = await apiUpdateSubtask(taskId, subtaskId, payload);
      setTasks((current) =>
        current.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((st) => (st.id === subtaskId ? updated : st)),
              }
            : t
        )
      );
      return updated;
    } catch (error) {
      refreshFromDB({ silent: true });
      throw error;
    }
  };

  const deleteSubtask = async (taskId: number, subtaskId: number): Promise<void> => {
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((st) => st.id !== subtaskId) }
          : t
      )
    );
    try {
      await apiDeleteSubtask(taskId, subtaskId);
    } catch (error) {
      refreshFromDB({ silent: true });
      throw error;
    }
  };

  const incrementCommentCount = (taskId: number, delta = 1) => {
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? { ...t, comments_count: Math.max(0, (t.comments_count || 0) + delta) }
          : t
      )
    );
  };

  const clearCache = () => {
    if (CACHE_KEY) sessionStorage.removeItem(CACHE_KEY);
    if (STATS_KEY) sessionStorage.removeItem(STATS_KEY);
    if (SYNC_KEY) sessionStorage.removeItem(SYNC_KEY);
    setTasks([]);
    setStats(null);
    setLastSynced(null);
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        filteredTasks,
        stats: computedStats,
        total: tasks.length,
        isLoading,
        isSyncing,
        lastSynced,
        filterParams,
        setFilterParams,
        resetFilters,
        createTask,
        updateTask,
        deleteTask,
        restoreTask,
        toggleTaskStatus,
        reorderTasks,
        createSubtask,
        updateSubtask,
        deleteSubtask,
        incrementCommentCount,
        refreshFromDB,
        notifyAssistantAction,
        clearCache,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export function useTaskCache() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskCache must be used within a TaskProvider");
  }
  return context;
}
