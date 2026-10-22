import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Download, FileUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createComment, deleteComment, fetchComments, updateComment } from "@/api/comments";
import { bulkCompleteTasks, bulkDeleteTasks, reassignTask } from "@/api/admin";
import { createTask, createSubtask, deleteSubtask, deleteTask, exportTasks, fetchTaskStats, fetchTasks, importTasks, reorderTasks, restoreTask, toggleTaskStatus, updateSubtask, updateTask } from "@/api/tasks";
import { Comment, DuplicateStrategy, Priority, Status, Task, TaskCreatePayload, TaskFilterParams, TaskStats, User } from "@/types";

interface TaskWorkspaceProps {
  isAdmin: boolean;
  currentUserId: number;
  users: User[];
}

const emptyDraft: { title: string; description: string; priority: Priority; due_date: string; tags: string; category: string } = {
  title: "",
  description: "",
  priority: "medium",
  due_date: "",
  tags: "",
  category: "",
};

export function TaskWorkspace({ isAdmin, currentUserId, users }: TaskWorkspaceProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "">("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<TaskFilterParams["sort"]>("position");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [overdue, setOverdue] = useState(false);
  const [dueToday, setDueToday] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateStrategy>("skip");
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    const params: TaskFilterParams = {
      q: search.trim() || undefined,
      status: status || undefined,
      priority: priority || undefined,
      tag: tag.trim() || undefined,
      overdue: overdue || undefined,
      due_today: dueToday || undefined,
      user_id: isAdmin && ownerId ? Number(ownerId) : undefined,
      page,
      page_size: 20,
      sort,
      order,
    };
    fetchTasks(params)
      .then((result) => {
        if (!current) return;
        setTasks(result.items);
        setTotal(result.total);
        setPages(result.pages);
        setSelectedIds([]);
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [search, status, priority, tag, sort, order, overdue, dueToday, ownerId, page, isAdmin]);

  useEffect(() => {
    fetchTaskStats(isAdmin && ownerId ? Number(ownerId) : undefined)
      .then(setStats)
      .catch((error: Error) => toast.error(error.message));
  }, [isAdmin, ownerId]);

  function refresh() {
    const params: TaskFilterParams = {
      q: search.trim() || undefined,
      status: status || undefined,
      priority: priority || undefined,
      tag: tag.trim() || undefined,
      overdue: overdue || undefined,
      due_today: dueToday || undefined,
      user_id: isAdmin && ownerId ? Number(ownerId) : undefined,
      page,
      page_size: 20,
      sort,
      order,
    };
    fetchTasks(params).then((result) => {
      setTasks(result.items);
      setTotal(result.total);
      setPages(result.pages);
    }).catch((error: Error) => toast.error(error.message));
  }

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

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setSaving(true);
    const payload: TaskCreatePayload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      due_date: draft.due_date || null,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      category: draft.category.trim() || null,
    };
    try {
      if (editingId) {
        await updateTask(editingId, payload);
        toast.success("Task updated.");
      } else {
        await createTask(payload);
        toast.success("Task created.");
      }
      setDraft(emptyDraft);
      setEditingId(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save task.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(task: Task) {
    try {
      await deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setTotal((value) => Math.max(0, value - 1));
      toast("Task moved to deleted items.", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreTask(task.id);
              toast.success("Task restored.");
              refresh();
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

  async function moveTask(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tasks.length) return;
    const ordered = [...tasks];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setTasks(ordered);
    try {
      await reorderTasks(ordered.map((task) => task.id));
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reorder tasks.");
      refresh();
    }
  }

  async function download(format: "csv" | "json") {
    try {
      const blob = await exportTasks(format, {
        q: search.trim() || undefined,
        status: status || undefined,
        priority: priority || undefined,
        tag: tag.trim() || undefined,
        overdue: overdue || undefined,
        due_today: dueToday || undefined,
        user_id: isAdmin && ownerId ? Number(ownerId) : undefined,
        sort,
        order,
      });
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

  async function runBulkAction(action: "complete" | "delete") {
    if (!selectedIds.length) return;
    if (action === "delete" && !window.confirm(`Soft-delete ${selectedIds.length} selected tasks?`)) return;
    try {
      const result = action === "complete"
        ? await bulkCompleteTasks(selectedIds)
        : await bulkDeleteTasks(selectedIds);
      toast.success(result.message);
      setSelectedIds([]);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk action failed.");
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    try {
      const preview = await importTasks(file, {
        on_duplicate: duplicateMode,
        dry_run: true,
        target_user_id: isAdmin && ownerId ? Number(ownerId) : undefined,
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
        target_user_id: isAdmin && ownerId ? Number(ownerId) : undefined,
      });
      toast.success(result.message || `Imported ${result.imported_rows} tasks.`);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <section className="task-workspace" aria-labelledby="tasks-heading">
      <div className="workspace-page-heading">
        <div><span className="assistant-kicker">{isAdmin ? "SYSTEM TASKS" : "MY WORK"}</span><h2 id="tasks-heading">Tasks <small>{total}</small></h2></div>
        <div className="transfer-actions">
          <button type="button" title="Export CSV" aria-label="Export CSV" onClick={() => download("csv")}><Download size={15} /> CSV</button>
          <button type="button" title="Export JSON" aria-label="Export JSON" onClick={() => download("json")}><Download size={15} /> JSON</button>
          <label className="upload-control" title="Import tasks from CSV or JSON"><FileUp size={15} /> Import<input type="file" accept=".csv,.json,application/json,text/csv" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          <select aria-label="Duplicate import behavior" value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateStrategy)}>
            <option value="skip">Skip duplicates</option><option value="overwrite">Overwrite duplicates</option><option value="create">Create duplicates</option>
          </select>
        </div>
      </div>

      {stats && <div className="personal-stats" aria-label="Task totals">
        <span><strong>{stats.pending}</strong> pending</span><span><strong>{stats.in_progress}</strong> in progress</span><span><strong>{stats.completed}</strong> complete</span><span className="overdue-stat"><strong>{stats.overdue}</strong> overdue</span>
      </div>}

      <form className="task-editor" onSubmit={submitTask}>
        <div className="task-editor-title"><strong>{editingId ? "Edit task" : "New task"}</strong>{editingId && <button type="button" className="icon-control" aria-label="Cancel edit" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}><X size={15} /></button>}</div>
        <div className="task-editor-grid">
          <input aria-label="Task title" placeholder="What needs doing?" maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
          <select aria-label="Task priority" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as typeof draft.priority })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
          <input aria-label="Due date" type="date" value={draft.due_date} onChange={(event) => setDraft({ ...draft, due_date: event.target.value })} />
          <input aria-label="Task category" placeholder="Category" maxLength={60} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
          <input aria-label="Task tags" placeholder="Tags, comma separated" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
          <input aria-label="Task description" placeholder="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <button className="action-button" type="submit" disabled={saving}><Plus size={15} />{saving ? "Saving…" : editingId ? "Save task" : "Add task"}</button>
        </div>
      </form>

      <div className="task-filters">
        <input aria-label="Search tasks" placeholder="Search tasks" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value as Status | ""); setPage(1); }}><option value="">All statuses</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
        <select aria-label="Filter by priority" value={priority} onChange={(event) => { setPriority(event.target.value as typeof priority); setPage(1); }}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <input aria-label="Filter by tag" placeholder="Tag" value={tag} onChange={(event) => { setTag(event.target.value); setPage(1); }} />
        <select aria-label="Sort tasks" value={sort} onChange={(event) => setSort(event.target.value as TaskFilterParams["sort"])}><option value="position">Manual order</option><option value="due_date">Due date</option><option value="priority">Priority</option><option value="created">Created</option></select>
        <button type="button" className="sort-direction" aria-label={`Sort ${order === "asc" ? "descending" : "ascending"}`} onClick={() => setOrder((value) => value === "asc" ? "desc" : "asc")}>{order === "asc" ? "↑" : "↓"}</button>
        {isAdmin && <select aria-label="Filter by owner" value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setPage(1); }}><option value="">All owners</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>}
        <label><input type="checkbox" checked={overdue} onChange={(event) => { setOverdue(event.target.checked); setPage(1); }} /> Overdue</label>
        <label><input type="checkbox" checked={dueToday} onChange={(event) => { setDueToday(event.target.checked); setPage(1); }} /> Due today</label>
      </div>

      {isAdmin && selectedIds.length > 0 && <div className="bulk-toolbar"><span>{selectedIds.length} selected</span><button type="button" onClick={() => void runBulkAction("complete")}>Mark complete</button><button type="button" className="danger-control" onClick={() => void runBulkAction("delete")}>Delete</button><button type="button" aria-label="Clear selection" onClick={() => setSelectedIds([])}><X size={14} /></button></div>}

      <div className="task-list" aria-live="polite">
        {loading ? <div className="workspace-empty">Loading tasks…</div> : tasks.length === 0 ? <div className="workspace-empty">No tasks match these filters.</div> : tasks.map((task, index) => (
          <article className={`task-row ${task.status}`} key={task.id}>
            <button type="button" className={`task-check ${task.status === "completed" ? "is-complete" : ""}`} aria-label={task.status === "completed" ? "Mark task incomplete" : "Mark task complete"} onClick={async () => { await toggleTaskStatus(task.id); refresh(); }}><Check size={15} /></button>
            <div className="task-row-main">
              <div className="task-row-title"><strong>{task.title}</strong><span className={`priority-label ${task.priority}`}>{task.priority}</span>{isAdmin && <span className="owner-label">{task.owner_name ?? `User ${task.user_id}`}</span>}</div>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">{task.due_date && <span>Due {task.due_date}</span>}{task.category && <span>{task.category}</span>}{task.tags.map((tag) => <span key={tag}>#{tag}</span>)}<span>{task.comments_count} comments</span></div>
              <TaskDetails task={task} currentUserId={currentUserId} isAdmin={isAdmin} onRefresh={refresh} />
            </div>
            <div className="task-row-actions">
              {isAdmin && <input className="task-select" type="checkbox" aria-label={`Select ${task.title}`} checked={selectedIds.includes(task.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} />}
              {isAdmin && <select className="reassign-select" aria-label={`Reassign ${task.title}`} value={task.user_id} onChange={async (event) => { try { await reassignTask(task.id, Number(event.target.value)); toast.success("Task reassigned."); refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not reassign task."); } }}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>}
              <button type="button" className="icon-control" aria-label="Move task up" title="Move up" disabled={index === 0} onClick={() => void moveTask(index, -1)}><ArrowUp size={15} /></button>
              <button type="button" className="icon-control" aria-label="Move task down" title="Move down" disabled={index === tasks.length - 1} onClick={() => void moveTask(index, 1)}><ArrowDown size={15} /></button>
              <button type="button" className="icon-control" aria-label="Edit task" title="Edit task" onClick={() => beginEdit(task)}><Pencil size={15} /></button>
              <button type="button" className="icon-control danger-control" aria-label="Delete task" title="Delete task" onClick={() => void removeTask(task)}><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>
      <div className="task-pagination"><span>Page {pages === 0 ? 0 : page} of {pages}</span><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronUp size={15} /></button><button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronDown size={15} /></button></div>
    </section>
  );
}

function TaskDetails({ task, currentUserId, isAdmin, onRefresh }: { task: Task; currentUserId: number; isAdmin: boolean; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");

  useEffect(() => {
    let current = true;
    if (open) fetchComments(task.id).then((data) => current && setComments(data)).catch((error: Error) => toast.error(error.message));
    return () => { current = false; };
  }, [open, task.id]);

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    try {
      await createComment(task.id, commentDraft.trim());
      setCommentDraft("");
      setComments(await fetchComments(task.id));
      onRefresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add comment."); }
  }

  async function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subtaskDraft.trim()) return;
    try {
      await createSubtask(task.id, subtaskDraft.trim());
      setSubtaskDraft("");
      onRefresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add checklist item."); }
  }

  async function saveCommentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingCommentId === null || !editingCommentBody.trim()) return;
    try {
      await updateComment(task.id, editingCommentId, editingCommentBody.trim());
      setEditingCommentId(null);
      setEditingCommentBody("");
      setComments(await fetchComments(task.id));
      onRefresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update comment."); }
  }

  return (
    <div className="task-details">
      <button type="button" className="details-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Hide checklist and comments" : `Checklist (${task.subtasks.filter((item) => item.is_done).length}/${task.subtasks.length}) · Open details`}<ChevronDown size={14} /></button>
      {open && <div className="task-details-content">
        <div className="subtask-section"><strong>Checklist</strong>
          {task.subtasks.map((subtask) => <div className="subtask-row" key={subtask.id}><label><input type="checkbox" checked={subtask.is_done} onChange={async (event) => { await updateSubtask(task.id, subtask.id, { is_done: event.target.checked }); onRefresh(); }} />{subtask.title}</label><button type="button" aria-label={`Delete ${subtask.title}`} className="icon-control danger-control" onClick={async () => { await deleteSubtask(task.id, subtask.id); onRefresh(); }}><Trash2 size={13} /></button></div>)}
          <form className="inline-compose" onSubmit={addSubtask}><input aria-label="New checklist item" placeholder="Add checklist item" value={subtaskDraft} onChange={(event) => setSubtaskDraft(event.target.value)} maxLength={200} /><button type="submit" aria-label="Add checklist item"><Plus size={14} /></button></form>
        </div>
        <div className="comment-section"><strong>Comments</strong>
          {comments.map((comment) => <div className="comment-row" key={comment.id}><div><b>{comment.author_name ?? `User ${comment.user_id}`}</b>{editingCommentId === comment.id ? <form className="inline-compose" onSubmit={saveCommentEdit}><input aria-label="Edit comment" value={editingCommentBody} onChange={(event) => setEditingCommentBody(event.target.value)} maxLength={1000} /><button type="submit" aria-label="Save comment"><Check size={13} /></button><button type="button" aria-label="Cancel edit" onClick={() => setEditingCommentId(null)}><X size={13} /></button></form> : <p>{comment.body}{comment.is_edited && <small> · edited</small>}</p>}</div><div className="comment-actions">{comment.user_id === currentUserId && editingCommentId !== comment.id && <button type="button" aria-label="Edit comment" className="icon-control" onClick={() => { setEditingCommentId(comment.id); setEditingCommentBody(comment.body); }}><Pencil size={13} /></button>}{(comment.user_id === currentUserId || isAdmin) && <button type="button" aria-label="Delete comment" className="icon-control danger-control" onClick={async () => { try { await deleteComment(task.id, comment.id); setComments(await fetchComments(task.id)); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete comment."); } }}><Trash2 size={13} /></button>}</div></div>)}
          <form className="inline-compose" onSubmit={addComment}><input aria-label="Write a comment" placeholder="Write a comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={1000} /><button type="submit" aria-label="Post comment"><Plus size={14} /></button></form>
        </div>
      </div>}
  </div>
  );
}
