// ============================================================================
// FILE:       frontend/src/components/TaskWorkspace.tsx
// PURPOSE:    Task management workspace with zero-latency cached state, instant
//             filtering, optimistic updates, and background database syncing.
// ============================================================================

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileUp,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createComment, deleteComment, fetchComments, updateComment } from "@/api/comments";
import { bulkCompleteTasks, bulkDeleteTasks, reassignTask } from "@/api/admin";
import { exportTasks, importTasks } from "@/api/tasks";
import { useTaskCache } from "@/context/TaskContext";
import {
  Comment,
  DuplicateStrategy,
  Priority,
  Status,
  Task,
  TaskCreatePayload,
  User,
} from "@/types";

interface TaskWorkspaceProps {
  isAdmin: boolean;
  currentUserId: number;
  users: User[];
}

const emptyDraft: {
  title: string;
  description: string;
  priority: Priority;
  due_date: string;
  tags: string;
  category: string;
} = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  tags: "",
  category: "",
};

export function TaskWorkspace({ isAdmin, currentUserId, users }: TaskWorkspaceProps) {
  const {
    tasks,
    filteredTasks,
    stats,
    isLoading,
    isSyncing,
    lastSynced,
    filterParams,
    setFilterParams,
    createTask,
    updateTask,
    deleteTask,
    restoreTask,
    toggleTaskStatus,
    reorderTasks,
    refreshFromDB,
  } = useTaskCache();

  // Local UI state
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateStrategy>("skip");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Owner map for easy lookup
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const currentUserName = userMap.get(currentUserId) || "You";

  // Client-side pagination based on filteredTasks
  const totalFiltered = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  // Relative time helper for sync badge
  const syncLabel = useMemo(() => {
    if (isSyncing) return "Syncing with DB…";
    if (!lastSynced) return "Cached";
    const diffSec = Math.floor((Date.now() - lastSynced.getTime()) / 1000);
    if (diffSec < 10) return "Synced just now";
    if (diffSec < 60) return `Synced ${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `Synced ${diffMin}m ago`;
  }, [isSyncing, lastSynced]);

  // Begin editing a task
  function beginEdit(task: Task) {
    setEditingId(task.id);
    setDraft({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      due_date: task.due_date ?? "",
      tags: task.tags.join(", "),
      category: task.category ?? "",
    });
  }

  // Clone / Duplicate a task
  async function cloneTask(task: Task) {
    try {
      await createTask({
        title: `${task.title} (Copy)`,
        description: task.description,
        priority: task.priority,
        due_date: task.due_date,
        tags: [...task.tags],
        category: task.category,
      }, currentUserName);
      toast.success("Task cloned successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clone task.");
    }
  }

  // Submit task (Create or Edit)
  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || saving) return;

    setSaving(true);
    const payload: TaskCreatePayload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      due_date: draft.due_date || null,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      category: draft.category.trim() || null,
    };

    try {
      if (editingId) {
        await updateTask(editingId, payload);
        toast.success("Task updated.");
        setEditingId(null);
      } else {
        await createTask(payload, currentUserName);
        toast.success("Task created.");
      }
      setDraft(emptyDraft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save task.");
    } finally {
      setSaving(false);
    }
  }

  // Remove task (with Undo option)
  async function removeTask(task: Task) {
    try {
      await deleteTask(task.id);
      toast("Task deleted.", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreTask(task.id);
              toast.success("Task restored.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not restore task.");
            }
          },
        },
        duration: 5000,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete task.");
    }
  }

  // Move task up/down (Manual order)
  async function moveTask(indexInPage: number, direction: -1 | 1) {
    const globalIndex = (currentPage - 1) * pageSize + indexInPage;
    const targetGlobal = globalIndex + direction;
    if (targetGlobal < 0 || targetGlobal >= tasks.length) return;

    const ordered = [...tasks];
    [ordered[globalIndex], ordered[targetGlobal]] = [ordered[targetGlobal], ordered[globalIndex]];

    try {
      await reorderTasks(ordered.map((t) => t.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reorder tasks.");
    }
  }

  // Export tasks
  async function download(format: "csv" | "json") {
    try {
      const blob = await exportTasks(format, filterParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasks.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    }
  }

  // Bulk actions for admin
  async function runBulkAction(action: "complete" | "delete") {
    if (!selectedIds.length) return;
    if (action === "delete" && !window.confirm(`Soft-delete ${selectedIds.length} selected tasks?`)) return;

    try {
      const result = action === "complete"
        ? await bulkCompleteTasks(selectedIds)
        : await bulkDeleteTasks(selectedIds);
      toast.success(result.message);
      setSelectedIds([]);
      await refreshFromDB({ silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk action failed.");
    }
  }

  // Import tasks
  async function upload(file?: File) {
    if (!file) return;
    try {
      const preview = await importTasks(file, {
        on_duplicate: duplicateMode,
        dry_run: true,
        target_user_id: isAdmin && filterParams.user_id ? filterParams.user_id : undefined,
      });
      const report = `Preview: ${preview.valid_rows} valid, ${preview.invalid_rows} invalid, ${preview.skipped_rows} duplicates.`;
      if (preview.invalid_rows > 0) {
        toast.error(`${report} Fix invalid rows before importing.`);
        return;
      }
      if (!window.confirm(`${report} Import these tasks now?`)) return;

      const result = await importTasks(file, {
        on_duplicate: duplicateMode,
        dry_run: false,
        target_user_id: isAdmin && filterParams.user_id ? filterParams.user_id : undefined,
      });
      toast.success(result.message || `Imported ${result.imported_rows} tasks.`);
      await refreshFromDB({ force: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <section className="task-workspace" aria-labelledby="tasks-heading">
      {/* Workspace Page Heading with Cache & Sync Status */}
      <div className="workspace-page-heading">
        <div>
          <span className="assistant-kicker">{isAdmin ? "SYSTEM TASKS" : "MY WORK"}</span>
          <div className="flex items-center gap-3">
            <h2 id="tasks-heading" className="flex items-center gap-2">
              Tasks <small>{tasks.length}</small>
            </h2>

            {/* Live Cache Status Badge & Manual Sync Button */}
            <button
              type="button"
              onClick={() => void refreshFromDB({ force: true })}
              title="Click to manually refresh and sync with database"
              aria-label="Refresh and sync tasks from database"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span>{syncLabel}</span>
            </button>
          </div>
        </div>

        {/* Transfer / Export / Import Controls */}
        <div className="transfer-actions">
          <button type="button" title="Export CSV" aria-label="Export CSV" onClick={() => download("csv")}>
            <Download size={15} /> CSV
          </button>
          <button type="button" title="Export JSON" aria-label="Export JSON" onClick={() => download("json")}>
            <Download size={15} /> JSON
          </button>
          <label className="upload-control" title="Import tasks from CSV or JSON">
            <FileUp size={15} /> Import
            <input
              type="file"
              accept=".csv,.json,application/json,text/csv"
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <select
            aria-label="Duplicate import behavior"
            value={duplicateMode}
            onChange={(event) => setDuplicateMode(event.target.value as DuplicateStrategy)}
          >
            <option value="skip">Skip duplicates</option>
            <option value="overwrite">Overwrite duplicates</option>
            <option value="create">Create duplicates</option>
          </select>
        </div>
      </div>

      {/* Task Statistics Bar */}
      {stats && (
        <div className="personal-stats" aria-label="Task totals">
          <span>
            <strong>{stats.pending}</strong> pending
          </span>
          <span>
            <strong>{stats.in_progress}</strong> in progress
          </span>
          <span>
            <strong>{stats.completed}</strong> complete
          </span>
          <span className="overdue-stat">
            <strong>{stats.overdue}</strong> overdue
          </span>
        </div>
      )}

      {/* Task Editor Form (Create / Edit) */}
      <form
        className="task-editor"
        onSubmit={submitTask}
        onKeyDown={(e) => {
          if (e.key === "Escape" && editingId) {
            setEditingId(null);
            setDraft(emptyDraft);
          }
        }}
      >
        <div className="task-editor-title">
          <strong>{editingId ? "Edit task" : "New task"}</strong>
          {editingId && (
            <button
              type="button"
              className="icon-control"
              aria-label="Cancel edit"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft);
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="task-editor-grid">
          <input
            aria-label="Task title"
            placeholder="What needs doing? (Ctrl+Enter to save)"
            maxLength={200}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            required
          />
          <select
            aria-label="Task priority"
            value={draft.priority}
            onChange={(event) =>
              setDraft({ ...draft, priority: event.target.value as typeof draft.priority })
            }
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          <input
            aria-label="Due date"
            type="date"
            value={draft.due_date}
            onChange={(event) => setDraft({ ...draft, due_date: event.target.value })}
          />
          <input
            aria-label="Task category"
            placeholder="Category"
            maxLength={60}
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
          <input
            aria-label="Task tags"
            placeholder="Tags, comma separated"
            value={draft.tags}
            onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
          />
          <input
            aria-label="Task description"
            placeholder="Description"
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
          <button className="action-button" type="submit" disabled={saving || !draft.title.trim()}>
            <Plus size={15} />
            {saving ? "Saving…" : editingId ? "Save task" : "Add task"}
          </button>
        </div>
      </form>

      {/* Quick Filter Pills */}
      <div className="flex items-center gap-1.5 flex-wrap my-1">
        <button
          type="button"
          onClick={() => {
            setFilterParams((prev) => ({ ...prev, status: undefined, overdue: false, due_today: false }));
            setPage(1);
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            !filterParams.status && !filterParams.overdue && !filterParams.due_today
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterParams((prev) => ({ ...prev, status: "pending", overdue: false, due_today: false }));
            setPage(1);
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            filterParams.status === "pending"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
        >
          Pending ({stats?.pending ?? 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterParams((prev) => ({ ...prev, status: "in_progress", overdue: false, due_today: false }));
            setPage(1);
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            filterParams.status === "in_progress"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
        >
          In Progress ({stats?.in_progress ?? 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterParams((prev) => ({ ...prev, status: "completed", overdue: false, due_today: false }));
            setPage(1);
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            filterParams.status === "completed"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
        >
          Completed ({stats?.completed ?? 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterParams((prev) => ({ ...prev, priority: prev.priority === "high" ? undefined : "high" }));
            setPage(1);
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            filterParams.priority === "high"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-white/5 text-rose-300 hover:bg-white/10"
          }`}
        >
          High Priority
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterParams((prev) => ({ ...prev, overdue: !prev.overdue }));
            setPage(1);
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            filterParams.overdue
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-white/5 text-amber-300 hover:bg-white/10"
          }`}
        >
          Overdue ({stats?.overdue ?? 0})
        </button>
      </div>

      {/* Advanced Filters */}
      <div className="task-filters">
        <input
          aria-label="Search tasks"
          placeholder="Instant search tasks..."
          value={filterParams.q || ""}
          onChange={(event) => {
            setFilterParams((prev) => ({ ...prev, q: event.target.value }));
            setPage(1);
          }}
        />
        <select
          aria-label="Filter by status"
          value={filterParams.status || ""}
          onChange={(event) => {
            setFilterParams((prev) => ({
              ...prev,
              status: (event.target.value as Status) || undefined,
            }));
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
        <select
          aria-label="Filter by priority"
          value={filterParams.priority || ""}
          onChange={(event) => {
            setFilterParams((prev) => ({
              ...prev,
              priority: (event.target.value as Priority) || undefined,
            }));
            setPage(1);
          }}
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          aria-label="Filter by tag"
          placeholder="Filter by tag"
          value={filterParams.tag || ""}
          onChange={(event) => {
            setFilterParams((prev) => ({ ...prev, tag: event.target.value }));
            setPage(1);
          }}
        />
        <select
          aria-label="Sort tasks"
          value={filterParams.sort || "position"}
          onChange={(event) =>
            setFilterParams((prev) => ({
              ...prev,
              sort: event.target.value as typeof filterParams.sort,
            }))
          }
        >
          <option value="position">Manual order</option>
          <option value="due_date">Due date</option>
          <option value="priority">Priority</option>
          <option value="created">Created</option>
        </select>
        <button
          type="button"
          className="sort-direction"
          aria-label={`Sort ${filterParams.order === "asc" ? "descending" : "ascending"}`}
          onClick={() =>
            setFilterParams((prev) => ({
              ...prev,
              order: prev.order === "asc" ? "desc" : "asc",
            }))
          }
        >
          {filterParams.order === "asc" ? "↑" : "↓"}
        </button>
        {isAdmin && (
          <select
            aria-label="Filter by owner"
            value={filterParams.user_id || ""}
            onChange={(event) => {
              setFilterParams((prev) => ({
                ...prev,
                user_id: event.target.value ? Number(event.target.value) : undefined,
              }));
              setPage(1);
            }}
          >
            <option value="">All owners</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        )}
        <label>
          <input
            type="checkbox"
            checked={!!filterParams.overdue}
            onChange={(event) => {
              setFilterParams((prev) => ({ ...prev, overdue: event.target.checked }));
              setPage(1);
            }}
          />{" "}
          Overdue
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!filterParams.due_today}
            onChange={(event) => {
              setFilterParams((prev) => ({ ...prev, due_today: event.target.checked }));
              setPage(1);
            }}
          />{" "}
          Due today
        </label>
      </div>

      {/* Bulk Toolbar for Admin */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="bulk-toolbar">
          <span>{selectedIds.length} selected</span>
          <button type="button" onClick={() => void runBulkAction("complete")}>
            Mark complete
          </button>
          <button type="button" className="danger-control" onClick={() => void runBulkAction("delete")}>
            Delete
          </button>
          <button type="button" aria-label="Clear selection" onClick={() => setSelectedIds([])}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="task-list" aria-live="polite">
        {isLoading && tasks.length === 0 ? (
          <div className="workspace-empty flex items-center justify-center gap-2 py-8">
            <RefreshCw size={18} className="animate-spin text-purple-400" />
            <span>Loading tasks from database…</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="workspace-empty py-8 text-center text-gray-400">
            {tasks.length === 0 ? "No tasks yet. Create one above to get started!" : "No tasks match these filters."}
          </div>
        ) : (
          paginatedTasks.map((task, index) => (
            <article className={`task-row ${task.status}`} key={task.id}>
              {/* Checkbox button */}
              <button
                type="button"
                className={`task-check ${task.status === "completed" ? "is-complete" : ""}`}
                aria-label={task.status === "completed" ? "Mark task incomplete" : "Mark task complete"}
                onClick={async () => {
                  const desired = task.status !== "completed";
                  try {
                    await toggleTaskStatus(task.id, desired);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not update task.");
                  }
                }}
              >
                <Check size={15} />
              </button>

              {/* Task Details Content */}
              <div className="task-row-main">
                <div className="task-row-title">
                  <strong>{task.title}</strong>
                  <span className={`priority-label ${task.priority}`}>{task.priority}</span>
                  {isAdmin && (
                    <span className="owner-label">{task.owner_name ?? `User ${task.user_id}`}</span>
                  )}
                </div>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  {task.due_date && <span>Due {task.due_date}</span>}
                  {task.category && <span>{task.category}</span>}
                  {task.tags.map((tg) => (
                    <span key={tg}>#{tg}</span>
                  ))}
                  <span>{task.comments_count} comments</span>
                </div>
                <TaskDetails
                  task={task}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              </div>

              {/* Task Actions */}
              <div className="task-row-actions">
                {isAdmin && (
                  <input
                    className="task-select"
                    type="checkbox"
                    aria-label={`Select ${task.title}`}
                    checked={selectedIds.includes(task.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, task.id]
                          : current.filter((id) => id !== task.id)
                      )
                    }
                  />
                )}
                {isAdmin && (
                  <select
                    className="reassign-select"
                    aria-label={`Reassign ${task.title}`}
                    value={task.user_id}
                    onChange={async (event) => {
                      try {
                        await reassignTask(task.id, Number(event.target.value));
                        toast.success("Task reassigned.");
                        await refreshFromDB({ silent: true });
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not reassign task.");
                      }
                    }}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="icon-control"
                  aria-label="Clone task"
                  title="Clone task"
                  onClick={() => void cloneTask(task)}
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  className="icon-control"
                  aria-label="Move task up"
                  title="Move up"
                  disabled={index === 0 && currentPage === 1}
                  onClick={() => void moveTask(index, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-control"
                  aria-label="Move task down"
                  title="Move down"
                  disabled={index === paginatedTasks.length - 1 && currentPage === totalPages}
                  onClick={() => void moveTask(index, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="icon-control"
                  aria-label="Edit task"
                  title="Edit task"
                  onClick={() => beginEdit(task)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="icon-control danger-control"
                  aria-label="Delete task"
                  title="Delete task"
                  onClick={() => void removeTask(task)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="task-pagination">
          <span>
            Page {currentPage} of {totalPages} ({totalFiltered} total)
          </span>
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => setPage((v) => Math.max(1, v - 1))}
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
          >
            <ChevronDown size={15} />
          </button>
        </div>
      )}
    </section>
  );
}

function TaskDetails({
  task,
  currentUserId,
  isAdmin,
}: {
  task: Task;
  currentUserId: number;
  isAdmin: boolean;
}) {
  const { createSubtask, updateSubtask, deleteSubtask, incrementCommentCount } = useTaskCache();

  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");

  // Load comments when drawer is opened
  const loadComments = async () => {
    try {
      const data = await fetchComments(task.id);
      setComments(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load comments.");
    }
  };

  async function handleToggleOpen() {
    const nextState = !open;
    setOpen(nextState);
    if (nextState) {
      await loadComments();
    }
  }

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    try {
      await createComment(task.id, commentDraft.trim());
      setCommentDraft("");
      incrementCommentCount(task.id, 1);
      await loadComments();
      toast.success("Comment added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add comment.");
    }
  }

  async function handleAddSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subtaskDraft.trim()) return;
    try {
      await createSubtask(task.id, subtaskDraft.trim());
      setSubtaskDraft("");
      toast.success("Checklist item added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add checklist item.");
    }
  }

  async function handleSaveCommentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingCommentId === null || !editingCommentBody.trim()) return;
    try {
      await updateComment(task.id, editingCommentId, editingCommentBody.trim());
      setEditingCommentId(null);
      setEditingCommentBody("");
      await loadComments();
      toast.success("Comment updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update comment.");
    }
  }

  const completedSubtasksCount = task.subtasks.filter((st) => st.is_done).length;

  return (
    <div className="task-details">
      <button
        type="button"
        className="details-toggle"
        aria-expanded={open}
        onClick={handleToggleOpen}
      >
        <span>
          {open
            ? "Hide checklist and comments"
            : `Checklist (${completedSubtasksCount}/${task.subtasks.length}) · Open details`}
        </span>
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div className="task-details-content">
          {/* Subtasks Section */}
          <div className="subtask-section">
            <strong>Checklist</strong>
            {task.subtasks.map((st) => (
              <div className="subtask-row" key={st.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={st.is_done}
                    onChange={async (event) => {
                      try {
                        await updateSubtask(task.id, st.id, { is_done: event.target.checked });
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to toggle subtask.");
                      }
                    }}
                  />
                  <span className={st.is_done ? "line-through opacity-70" : ""}>{st.title}</span>
                </label>
                <button
                  type="button"
                  aria-label={`Delete ${st.title}`}
                  className="icon-control danger-control"
                  onClick={async () => {
                    try {
                      await deleteSubtask(task.id, st.id);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to delete subtask.");
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <form className="inline-compose" onSubmit={handleAddSubtask}>
              <input
                aria-label="New checklist item"
                placeholder="Add checklist item"
                value={subtaskDraft}
                onChange={(event) => setSubtaskDraft(event.target.value)}
                maxLength={200}
              />
              <button type="submit" aria-label="Add checklist item" disabled={!subtaskDraft.trim()}>
                <Plus size={14} />
              </button>
            </form>
          </div>

          {/* Comments Section */}
          <div className="comment-section">
            <strong>Comments</strong>
            {comments.map((comment) => (
              <div className="comment-row" key={comment.id}>
                <div>
                  <b>{comment.author_name ?? `User ${comment.user_id}`}</b>
                  {editingCommentId === comment.id ? (
                    <form className="inline-compose" onSubmit={handleSaveCommentEdit}>
                      <input
                        aria-label="Edit comment"
                        value={editingCommentBody}
                        onChange={(event) => setEditingCommentBody(event.target.value)}
                        maxLength={1000}
                      />
                      <button type="submit" aria-label="Save comment">
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel edit"
                        onClick={() => setEditingCommentId(null)}
                      >
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <p>
                      {comment.body}
                      {comment.is_edited && <small> · edited</small>}
                    </p>
                  )}
                </div>
                <div className="comment-actions">
                  {comment.user_id === currentUserId && editingCommentId !== comment.id && (
                    <button
                      type="button"
                      aria-label="Edit comment"
                      className="icon-control"
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditingCommentBody(comment.body);
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {(comment.user_id === currentUserId || isAdmin) && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      className="icon-control danger-control"
                      onClick={async () => {
                        try {
                          await deleteComment(task.id, comment.id);
                          incrementCommentCount(task.id, -1);
                          await loadComments();
                          toast.success("Comment deleted.");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not delete comment.");
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <form className="inline-compose" onSubmit={handleAddComment}>
              <input
                aria-label="Write a comment"
                placeholder="Write a comment"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                maxLength={1000}
              />
              <button type="submit" aria-label="Post comment" disabled={!commentDraft.trim()}>
                <Plus size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
