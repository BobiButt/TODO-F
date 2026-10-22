import { FormEvent, useEffect, useState } from "react";
import { Activity, BarChart3, MessageSquare, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { deleteComment } from "@/api/comments";
import { fetchActivityLog, fetchAdminStats, fetchModerationComments } from "@/api/admin";
import { createUser, deleteUser, fetchUsers, updateUser } from "@/api/users";
import { ActivityLog, AdminStats, CommentModerationItem, Role, User } from "@/types";
import { TaskWorkspace } from "@/components/TaskWorkspace";

interface AdminWorkspaceProps {
  currentUserId: number;
  users: User[];
  onUsersChanged: () => Promise<void>;
}

type AdminView = "overview" | "tasks" | "users" | "comments" | "activity";

export function AdminWorkspace({ currentUserId, users, onUsersChanged }: AdminWorkspaceProps) {
  const [view, setView] = useState<AdminView>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [comments, setComments] = useState<CommentModerationItem[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(users);
  const [userDraft, setUserDraft] = useState({ name: "", email: "", role: "user" as Role });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadAdminData() {
    setLoading(true);
    try {
      const [nextStats, nextComments, nextActivity, nextUsers] = await Promise.all([
        fetchAdminStats(),
        fetchModerationComments(100),
        fetchActivityLog(1, 50),
        fetchUsers(),
      ]);
      setStats(nextStats);
      setComments(nextComments);
      setActivity(nextActivity.items);
      setAllUsers(nextUsers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load administrator data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAdminData(); }, []);

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingUserId !== null) {
        await updateUser(editingUserId, userDraft);
        toast.success("User updated.");
      } else {
        await createUser(userDraft);
        toast.success("User created.");
      }
      setUserDraft({ name: "", email: "", role: "user" });
      setEditingUserId(null);
      await Promise.all([loadAdminData(), onUsersChanged()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save user.");
    }
  }

  async function removeUser(user: User) {
    if (!window.confirm(`Delete ${user.name}? Their tasks and comments will also be deleted.`)) return;
    try {
      await deleteUser(user.id);
      toast.success("User deleted.");
      await Promise.all([loadAdminData(), onUsersChanged()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete user.");
    }
  }

  async function removeComment(comment: CommentModerationItem) {
    if (!window.confirm(`Delete this comment on “${comment.task_title}”?`)) return;
    try {
      await deleteComment(comment.task_id, comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      toast.success("Comment deleted.");
      void loadAdminData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete comment.");
    }
  }

  const navigation: { id: AdminView; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "tasks", label: "Tasks", icon: Shield },
    { id: "users", label: "Users", icon: Users },
    { id: "comments", label: "Comments", icon: MessageSquare },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <section className="admin-workspace" aria-label="Administrator console">
      <nav className="admin-tabs" aria-label="Administrator sections">
        {navigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={15} />{label}</button>)}
      </nav>
      {view === "tasks" ? <TaskWorkspace isAdmin currentUserId={currentUserId} users={allUsers} /> : view === "overview" ? (
        <div className="admin-content">
          <div className="workspace-page-heading"><div><span className="assistant-kicker">ADMINISTRATION</span><h2>System overview</h2></div><button className="plain-button" onClick={() => void loadAdminData()} disabled={loading}>Refresh</button></div>
          {loading && !stats ? <div className="workspace-empty">Loading system metrics…</div> : stats && <>
            <div className="metric-grid">
              <Metric label="Users" value={stats.total_users} />
              <Metric label="Active tasks" value={stats.total_tasks} />
              <Metric label="Completion" value={`${stats.completion_rate}%`} />
              <Metric label="Overdue" value={stats.overdue_tasks} />
              <Metric label="Comments" value={stats.total_comments} />
            </div>
            <section className="admin-report"><h3>Tasks by user</h3>{stats.tasks_per_user.map((row) => <div className="user-stat-row" key={row.user_id}><span>{row.user_name}</span><span>{row.completed_count} / {row.task_count} complete</span><div className="stat-track"><span style={{ width: `${row.task_count ? (row.completed_count / row.task_count) * 100 : 0}%` }} /></div></div>)}</section>
          </>}
        </div>
      ) : view === "users" ? (
        <div className="admin-content">
          <div className="workspace-page-heading"><div><span className="assistant-kicker">IDENTITIES</span><h2>User management <small>{allUsers.length}</small></h2></div></div>
          <form className="user-editor" onSubmit={submitUser}>
            <input aria-label="User name" placeholder="Full name" maxLength={80} required value={userDraft.name} onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })} />
            <input aria-label="User email" placeholder="Email address" type="email" maxLength={255} required value={userDraft.email} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} />
            <select aria-label="User role" value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value as Role })}><option value="user">User</option><option value="admin">Admin</option></select>
            <button className="action-button" type="submit">{editingUserId ? "Save changes" : "Create user"}</button>
            {editingUserId !== null && <button className="plain-button" type="button" onClick={() => { setEditingUserId(null); setUserDraft({ name: "", email: "", role: "user" }); }}>Cancel</button>}
          </form>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>{allUsers.map((user) => <tr key={user.id}><td>{user.name}{user.id === currentUserId && <small> You</small>}</td><td>{user.email}</td><td><span className={`role-pill ${user.role}`}>{user.role}</span></td><td>{new Date(user.created_at).toLocaleDateString()}</td><td><button className="plain-button" onClick={() => { setEditingUserId(user.id); setUserDraft({ name: user.name, email: user.email, role: user.role }); }}>Edit</button><button className="icon-control danger-control" aria-label={`Delete ${user.name}`} disabled={user.id === currentUserId} onClick={() => void removeUser(user)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>
        </div>
      ) : view === "comments" ? (
        <div className="admin-content"><div className="workspace-page-heading"><div><span className="assistant-kicker">MODERATION</span><h2>Recent comments</h2></div></div>
          <div className="moderation-list">{comments.map((comment) => <article className="moderation-row" key={comment.id}><div><strong>{comment.author_name}</strong><span>{comment.task_title} · {new Date(comment.created_at).toLocaleString()}</span><p>{comment.body}</p></div><button className="icon-control danger-control" title="Delete comment" aria-label="Delete comment" onClick={() => void removeComment(comment)}><Trash2 size={15} /></button></article>)}{!comments.length && <div className="workspace-empty">No comments to moderate.</div>}</div>
        </div>
      ) : (
        <div className="admin-content"><div className="workspace-page-heading"><div><span className="assistant-kicker">AUDIT TRAIL</span><h2>Recent activity</h2></div></div>
          <div className="activity-list">{activity.map((item) => <article className="activity-row" key={item.id}><span>{item.action}</span><div><strong>{item.actor_name}</strong><p>{item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ""} · {JSON.stringify(item.detail)}</p></div><time>{new Date(item.created_at).toLocaleString()}</time></article>)}{!activity.length && <div className="workspace-empty">No activity recorded yet.</div>}</div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <article className="metric-item"><span>{label}</span><strong>{value}</strong></article>;
}
